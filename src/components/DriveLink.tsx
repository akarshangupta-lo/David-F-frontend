import React from 'react';
import { FolderPlus, Link2, Unlink, RefreshCw } from 'lucide-react';
import { useDrive } from '../hooks/useDrive';

export const DriveLink: React.FC = () => {
	const { state, linkDrive, unlinkDrive, ensureStructure } = useDrive();

	return (
		<div className="bg-white border rounded-lg p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3">
					<div className="h-8 w-8 bg-red-100 rounded flex items-center justify-center">
						<FolderPlus className="h-4 w-4 text-red-700" />
					</div>
					<div>
						<p className="text-sm font-medium text-gray-900">Google Drive Link</p>
						<p className="text-xs text-gray-600">{state.linked ? `Linked (Wine folder ID: ${state.folderId})` : 'Not linked'}</p>
					</div>
				</div>
				<div className="space-x-2">
					{state.linked ? (
						<>
							<button onClick={ensureStructure} className="inline-flex items-center px-3 py-2 text-sm border rounded">
								<RefreshCw className="h-4 w-4 mr-2" />
								Ensure Folders
							</button>
							<button onClick={unlinkDrive} className="inline-flex items-center px-3 py-2 text-sm border rounded">
								<Unlink className="h-4 w-4 mr-2" />
								Unlink
							</button>
						</>
					) : (
						<button onClick={linkDrive} className="inline-flex items-center px-3 py-2 text-sm bg-red-900 text-white rounded">
							<Link2 className="h-4 w-4 mr-2" />
							Link Drive
						</button>
					)}
				</div>
			</div>
			{state.error && (
				<p className="mt-3 text-sm text-red-600">{state.error}</p>
			)}
		</div>
	);
};
