import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Play, StopCircle, Activity } from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { ProcessingTable } from './ProcessingTable';
import { useWineOcr } from '../hooks/useWineOcr';
import { DriveLink } from './DriveLink';

export const WineOcrWizard: React.FC = () => {
	const {
		step,
		rows,
		allRows,
		uploading,
		ocrLoading,
		compareLoading,
		healthLoading,
		healthStatus,
		error,
		filter,
		setStep,
		setFilter,
		healthCheck,
		handleUpload,
		runOcr,
		runCompare,
		uploadResultToDrive,
		updateResult,
		cancel,
		reset,
		exportCsvData
	} = useWineOcr();

	return (
		<div className="space-y-8">
			{/* Stepper */}
			<div className="grid grid-cols-4 gap-4">
				<div className={`${step >= 1 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
					<p className="text-sm font-medium">1. Link Drive</p>
				</div>
				<div className={`${step >= 2 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
					<p className="text-sm font-medium">2. Upload Images</p>
				</div>
				<div className={`${step >= 3 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
					<p className="text-sm font-medium">3. Process OCR</p>
				</div>
				<div className={`${step >= 4 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
					<p className="text-sm font-medium">4. Review Results</p>
				</div>
			</div>

			{/* Errors */}
			{error && (
				<div className="bg-red-50 border border-red-200 rounded p-3 flex items-start space-x-2">
					<AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
					<p className="text-sm text-red-800">{error}</p>
				</div>
			)}

			{/* Health Check */}
			<div className="flex items-center space-x-3">
				<button onClick={healthCheck} className="inline-flex items-center px-3 py-2 border rounded text-sm">
					<Activity className="h-4 w-4 mr-2" />
					{healthLoading ? 'Checking...' : 'Health Check'}
				</button>
				{healthStatus && <span className="text-xs text-gray-600">Backend: {healthStatus}</span>}
			</div>

			{/* Step 1: Drive link */}
			{step === 1 && (
				<div className="space-y-4">
					<DriveLink />
					<div className="flex justify-end">
						<button onClick={() => setStep(2)} className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800">Continue</button>
					</div>
				</div>
			)}

			{/* Step 2: Upload */}
			{step === 2 && (
				<div>
					<FileUploadZone onFilesSelected={(files) => { handleUpload(files); }} uploading={uploading} disabled={uploading} />
					{allRows.length > 0 && (
						<div className="mt-4 flex justify-between">
							<button onClick={() => setStep(1)} className="text-sm text-gray-600">Back</button>
							<button onClick={() => setStep(3)} className="px-4 py-2 rounded bg-red-900 text-white hover:bg-red-800">Continue</button>
						</div>
					)}
				</div>
			)}

			{/* Step 3: Processing */}
			{step === 3 && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<p className="text-sm text-gray-700">Run OCR first, then Compare.</p>
						<div className="space-x-2">
							<button
								onClick={runOcr}
								disabled={ocrLoading || allRows.length === 0}
								className="inline-flex items-center px-3 py-2 rounded bg-red-900 text-white disabled:opacity-50"
							>
								{ocrLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
								Run OCR
							</button>
							<button
								onClick={runCompare}
								disabled={compareLoading || allRows.length === 0}
								className="inline-flex items-center px-3 py-2 rounded border border-gray-300 text-gray-700 bg-white disabled:opacity-50"
							>
								{compareLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
								Compare
							</button>
							<button
								onClick={cancel}
								disabled={!ocrLoading && !compareLoading}
								className="inline-flex items-center px-3 py-2 rounded border border-gray-300 text-gray-700 bg-white disabled:opacity-50"
							>
								<StopCircle className="h-4 w-4 mr-2" />
								Cancel
							</button>
						</div>
					</div>

					<ProcessingTable files={rows} onUpdateResult={updateResult} onRetryFile={() => {}} onUploadToDrive={uploadResultToDrive} />

					<div className="flex justify-between">
						<button onClick={() => setStep(2)} className="text-sm text-gray-600">Back</button>
						<button onClick={() => setStep(4)} disabled={ocrLoading || compareLoading} className="px-4 py-2 rounded bg-red-900 text-white disabled:opacity-50">Continue</button>
					</div>
				</div>
			)}

			{/* Step 4: Review */}
			{step === 4 && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<select
								value={filter.status || ''}
								onChange={(e) => setFilter({ ...filter, status: (e.target.value as any) || undefined })}
								className="text-sm border-gray-300 rounded"
							>
								<option value="">All Statuses</option>
								<option value="formatted">Formatted</option>
								<option value="failed">Failed</option>
							</select>
							<label className="text-sm inline-flex items-center space-x-2">
								<input
									type="checkbox"
									checked={filter.needsReview || false}
									onChange={(e) => setFilter({ ...filter, needsReview: e.target.checked })}
									className="h-4 w-4 text-red-600"
								/>
								<span>Needs Review</span>
							</label>
							<input
								type="text"
								placeholder="Search..."
								value={filter.search || ''}
								onChange={(e) => setFilter({ ...filter, search: e.target.value })}
								className="text-sm border-gray-300 rounded px-2 py-1"
							/>
						</div>
						<div className="space-x-2">
							<button onClick={exportCsvData} className="px-3 py-2 rounded border border-gray-300 text-sm">Export CSV</button>
							<button onClick={reset} className="inline-flex items-center px-3 py-2 rounded bg-green-600 text-white">
								<CheckCircle2 className="h-4 w-4 mr-2" />
								Finish
							</button>
						</div>
					</div>

					<ProcessingTable files={rows} onUpdateResult={updateResult} onRetryFile={() => {}} onUploadToDrive={uploadResultToDrive} />
				</div>
			)}
		</div>
	);
};
