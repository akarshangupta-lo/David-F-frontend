import { useCallback, useEffect, useState } from 'react';

declare global {
	interface Window {
		google: any;
	}
}

export interface DriveState {
	linked: boolean;
	folderId?: string;
	accessToken?: string;
	error?: string | null;
	ensuring?: boolean;
	structure?: {
		wineId?: string;
		inputId?: string;
		uploadId?: string;
		outputId?: string;
		nhrId?: string;
		nhrSearchFailedId?: string;
		nhrManualFailId?: string;
		nhrOcrFailId?: string;
		nhrOthersId?: string;
	};
}

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveRequest<T>(path: string, method: 'GET' | 'POST' | 'PATCH', token: string, body?: any, extraHeaders?: Record<string,string>): Promise<T> {
	const url = `https://www.googleapis.com/drive/v3${path}`;
	const res = await fetch(url, {
		method,
		headers: {
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			...(extraHeaders || {})
		},
		body: body ? JSON.stringify(body) : undefined
	});
	if (!res.ok) {
		let detail = `HTTP ${res.status}`;
		try { const j = await res.json(); detail = j.error?.message || detail; } catch {}
		throw new Error(detail);
	}
	return res.json() as Promise<T>;
}

async function uploadBinary(name: string, token: string, parentId: string, file: File): Promise<string> {
	const metadata = { name, parents: [parentId] };
	const form = new FormData();
	form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
	form.append('file', file);
	const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
		method: 'POST',
		headers: { 'Authorization': `Bearer ${token}` },
		body: form
	});
	if (!res.ok) throw new Error(`Drive upload failed: HTTP ${res.status}`);
	const j = await res.json();
	return j.id as string;
}

async function moveFile(fileId: string, token: string, newParentId: string): Promise<void> {
	// Retrieve existing parents
	const file = await driveRequest<{ parents: string[] }>(`/files/${encodeURIComponent(fileId)}?fields=parents`, 'GET', token);
	const prev = (file.parents || []).join(',');
	await driveRequest(`/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(newParentId)}&removeParents=${encodeURIComponent(prev)}&fields=id,parents`, 'PATCH', token);
}

async function copyFile(fileId: string, token: string, newParentId: string, newName?: string): Promise<string> {
	const body: any = { parents: [newParentId] };
	if (newName) body.name = newName;
	const res = await driveRequest<{ id: string }>(`/files/${encodeURIComponent(fileId)}/copy?fields=id`, 'POST', token, body);
	return res.id;
}

async function fileExists(id: string, token: string): Promise<boolean> {
	try {
		await driveRequest(`/files/${encodeURIComponent(id)}?fields=id`, 'GET', token);
		return true;
	} catch {
		return false;
	}
}

async function findFolderIdByName(name: string, token: string, parentId?: string): Promise<string | undefined> {
	const qParts = [
		`mimeType = '${DRIVE_FOLDER_MIME}'`,
		`name = '${name.replace(/'/g, "\\'")}'`,
		"trashed = false",
	];
	if (parentId) {
		qParts.push(`'${parentId}' in parents`);
	}
	const q = qParts.join(' and ');
	const resp = await driveRequest<{ files: Array<{ id: string; name: string }> }>(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`, 'GET', token);
	return resp.files?.[0]?.id;
}

async function createFolder(name: string, token: string, parentId?: string): Promise<string> {
	const body: any = {
		name,
		mimeType: DRIVE_FOLDER_MIME,
	};
	if (parentId) body.parents = [parentId];
	const resp = await driveRequest<{ id: string }>(`/files?fields=id`, 'POST', token, body);
	return resp.id;
}

async function ensureFolder(name: string, token: string, parentId?: string, existingId?: string): Promise<string> {
	if (existingId && await fileExists(existingId, token)) return existingId;
	const found = await findFolderIdByName(name, token, parentId);
	if (found) return found;
	return createFolder(name, token, parentId);
}

export const useDrive = () => {
	const [state, setState] = useState<DriveState>({ linked: false });

	const getToken = useCallback(async (): Promise<string> => {
		const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
		if (!clientId) throw new Error('Google Client ID missing (VITE_GOOGLE_CLIENT_ID)');
		await new Promise<void>((resolve) => {
			if (window.google?.accounts?.oauth2) return resolve();
			const script = document.createElement('script');
			script.src = 'https://accounts.google.com/gsi/client';
			script.async = true;
			script.onload = () => resolve();
			document.head.appendChild(script);
		});
		return await new Promise<string>((resolve, reject) => {
			const tokenClient = window.google.accounts.oauth2.initTokenClient({
				client_id: clientId,
				scope: 'https://www.googleapis.com/auth/drive',
				prompt: '',
				callback: (resp: any) => {
					if (resp?.access_token) resolve(resp.access_token);
					else reject(new Error('Failed to acquire Drive access token'));
				},
			});
			tokenClient.requestAccessToken();
		});
	}, []);

	const ensureStructure = useCallback(async () => {
		try {
			setState(prev => ({ ...prev, ensuring: true, error: null }));
			const token = state.accessToken || await getToken();
			const stored = (() => { try { return JSON.parse(localStorage.getItem('drive_structure') || 'null'); } catch { return null; } })();

			let wineId = stored?.wineId && await fileExists(stored.wineId, token) ? stored.wineId : undefined;
			wineId = await ensureFolder('Wine', token, undefined, wineId);

			let inputId = stored?.inputId && await fileExists(stored.inputId, token) ? stored.inputId : undefined;
			inputId = await ensureFolder('input', token, wineId, inputId);
			let uploadId = stored?.uploadId && await fileExists(stored.uploadId, token) ? stored.uploadId : undefined;
			uploadId = await ensureFolder('upload', token, wineId, uploadId);
			let outputId = stored?.outputId && await fileExists(stored.outputId, token) ? stored.outputId : undefined;
			outputId = await ensureFolder('output', token, wineId, outputId);
			let nhrId = stored?.nhrId && await fileExists(stored.nhrId, token) ? stored.nhrId : undefined;
			nhrId = await ensureFolder('nhr', token, wineId, nhrId);

			let nhrSearchFailedId = stored?.nhrSearchFailedId && await fileExists(stored.nhrSearchFailedId, token) ? stored.nhrSearchFailedId : undefined;
			nhrSearchFailedId = await ensureFolder('search_failed', token, nhrId, nhrSearchFailedId);
			let nhrManualFailId = stored?.nhrManualFailId && await fileExists(stored.nhrManualFailId, token) ? stored.nhrManualFailId : undefined;
			nhrManualFailId = await ensureFolder('manual_fail', token, nhrId, nhrManualFailId);
			let nhrOcrFailId = stored?.nhrOcrFailId && await fileExists(stored.nhrOcrFailId, token) ? stored.nhrOcrFailId : undefined;
			nhrOcrFailId = await ensureFolder('ocr_fail', token, nhrId, nhrOcrFailId);
			let nhrOthersId = stored?.nhrOthersId && await fileExists(stored.nhrOthersId, token) ? stored.nhrOthersId : undefined;
			nhrOthersId = await ensureFolder('others', token, nhrId, nhrOthersId);

			const structure = { wineId, inputId, uploadId, outputId, nhrId, nhrSearchFailedId, nhrManualFailId, nhrOcrFailId, nhrOthersId };
			setState({ linked: true, accessToken: token, folderId: wineId, error: null, ensuring: false, structure });
			localStorage.setItem('drive_linked', 'true');
			localStorage.setItem('drive_folder', wineId);
			localStorage.setItem('drive_token', token);
			localStorage.setItem('drive_structure', JSON.stringify(structure));
		} catch (e: any) {
			setState(prev => ({ ...prev, error: e?.message || 'Failed to ensure Drive structure', ensuring: false }));
		}
	}, [getToken, state.accessToken]);

	const linkDrive = useCallback(async () => {
		await ensureStructure();
	}, [ensureStructure]);

	const unlinkDrive = useCallback(() => {
		setState({ linked: false });
		localStorage.removeItem('drive_linked');
		localStorage.removeItem('drive_folder');
		localStorage.removeItem('drive_token');
		localStorage.removeItem('drive_structure');
	}, []);

	useEffect(() => {
		const linked = localStorage.getItem('drive_linked') === 'true';
		if (linked) {
			setState({
				linked: true,
				folderId: localStorage.getItem('drive_folder') || undefined,
				accessToken: localStorage.getItem('drive_token') || undefined,
				structure: (() => { try { return JSON.parse(localStorage.getItem('drive_structure') || 'null') || undefined; } catch { return undefined; } })()
			});
		}
	}, []);

	const uploadToFolder = useCallback(async (file: File, targetFolderId: string): Promise<string> => {
		const token = state.accessToken || await getToken();
		return uploadBinary(file.name, token, targetFolderId, file);
	}, [getToken, state.accessToken]);

	const moveToFolder = useCallback(async (fileId: string, targetFolderId: string): Promise<void> => {
		const token = state.accessToken || await getToken();
		return moveFile(fileId, token, targetFolderId);
	}, [getToken, state.accessToken]);

	const copyToFolder = useCallback(async (fileId: string, targetFolderId: string, newName?: string): Promise<string> => {
		const token = state.accessToken || await getToken();
		return copyFile(fileId, token, targetFolderId, newName);
	}, [getToken, state.accessToken]);

	return { state, linkDrive, unlinkDrive, ensureStructure, uploadToFolder, moveToFolder, copyToFolder };
};
