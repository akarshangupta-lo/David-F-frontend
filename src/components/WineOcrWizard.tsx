import React from 'react';
import { AlertCircle, Loader2, Play, StopCircle, HardDrive } from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { ProcessingTable } from './ProcessingTable';
import { useWineOcr, TIME_PER_IMAGE_SECONDS, formatTime } from '../hooks/useWineOcr'; // Add imports
import { GoogleSignIn } from './GoogleSignIn';
import { useAuth } from '../hooks/useAuth';
import { useDrive } from '../hooks/useDrive';

export const WineOcrWizard: React.FC = () => {
  const { user } = useAuth();
  const { state: drive, connectDrive } = useDrive();
  const [preview, setPreview] = React.useState<{ url: string; name: string } | null>(null);

  const {
    step,
    rows,
    allRows,
    uploading,
    ocrLoading,
    compareLoading,
    ocrStarted,
    compareStarted,
    ocrLocked,
    compareLocked,
    canRunCompare,
    uploadMs,
    ocrMs,
    compareMs,
    error,
    filter,
    setStep,
    setFilter,
    handleUpload,
    runOcr,
    runCompare,
    uploadResultToDrive,
    updateResult,
    cancel,
    exportCsvData
  } = useWineOcr();

  const mustSignIn = !user;
  const mustLinkDrive = user && !drive.linked;

  return (
    <div className="space-y-8">
      {/* Drive Connection Status */}
      <div className="flex items-center justify-end space-x-2">
        <HardDrive className={drive.linked ? "text-green-500" : "text-red-500"} size={20} />
        <span className={`text-sm font-medium ${drive.linked ? "text-green-600" : "text-red-600"}`}>
          {drive.linked ? "Connected to Google Drive" : "Not Connected to Google Drive"}
        </span>
       
      </div>

      {/* Stepper simplified */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`${step >= 2 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
          <p className="text-sm font-medium">1. Upload</p>
        </div>
        <div className={`${step >= 3 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
          <p className="text-sm font-medium">2. OCR</p>
        </div>
        <div className={`${step >= 4 ? 'border-red-600 bg-red-50' : 'border-gray-200'} p-3 rounded border`}>
          <p className="text-sm font-medium">3. Review</p>
        </div>
      </div>

      {/* Add Image Count Display */}
      {allRows.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Total Images:</span>
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {allRows.length}
              </span>
            </div>
            {!ocrStarted && (
              <div className="text-sm text-gray-600">
                Estimated processing time: {formatTime(allRows.length * TIME_PER_IMAGE_SECONDS)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 2 && (
        <div>
          {mustSignIn && (
            <div className="mb-4">
              <p className="text-sm text-red-700 mb-2">Sign in first to proceed</p>
              <GoogleSignIn />
            </div>
          )}

          {!mustSignIn && mustLinkDrive && (
            <div className="mb-4 flex flex-col items-start space-y-2">
              <button
                onClick={connectDrive}
                disabled={!!drive.ensuring}
                className="flex items-center space-x-2 px-4 py-2 bg-red-900 text-white rounded-lg shadow hover:bg-red-800 disabled:opacity-50"
              >
                {drive.ensuring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <HardDrive className="h-4 w-4" />
                )}
                <span>{drive.ensuring ? 'Connecting...' : 'Connect Drive'}</span>
              </button>
              {drive.error && (
                <p className="text-sm text-red-600">❌ {drive.error}</p>
              )}
            </div>
          )}

          <FileUploadZone
  onFilesSelected={(files) => handleUpload(files)}
  uploading={uploading}
  disabled={!!(uploading || mustSignIn || mustLinkDrive)} // ✅ always boolean
  onPreviewFile={(file) => setPreview({ url: URL.createObjectURL(file), name: file.name })}
/>


          {uploading && (
            <div className="mt-3 text-sm text-gray-700 inline-flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading images...
            </div>
          )}
          {uploadMs != null && !uploading && (
            <div className="mt-2 text-xs text-gray-500">
              Upload completed in {(uploadMs / 1000).toFixed(2)} s
            </div>
          )}
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-x-2">
              {/* Add estimated time display */}
              
              <button
                onClick={runOcr}
                disabled={ocrLoading || allRows.length === 0 || ocrLocked}
                className="inline-flex items-center px-3 py-2 rounded bg-red-900 text-white disabled:opacity-50"
              >
                {ocrLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {ocrLocked ? 'OCR Complete' : 'Run OCR'}
              </button>
              <button
                onClick={runCompare}
                disabled={compareLoading || allRows.length === 0 || !canRunCompare || compareLocked}
                className="inline-flex items-center px-3 py-2 rounded border border-gray-300 text-gray-700 bg-white disabled:opacity-50"
              >
                {compareLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {compareLocked ? 'Compared' : 'Compare'}
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

          {(ocrLoading || compareLoading) && (
            <div className="text-sm text-gray-700 inline-flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />{' '}
              {ocrLoading ? 'Running OCR...' : 'Comparing matches...'}
            </div>
          )}
          {ocrMs != null && !ocrLoading && ocrLocked && (
            <div className="text-xs text-gray-500">
              OCR completed in {(ocrMs / 1000).toFixed(2)} s
            </div>
          )}
          {compareMs != null && !compareLoading && compareLocked && (
            <div className="text-xs text-gray-500">
              Compare completed in {(compareMs / 1000).toFixed(2)} s
            </div>
          )}

          <ProcessingTable
            files={rows}
            onUpdateResult={updateResult}
            onRetryFile={() => {}}
            onUploadToDrive={uploadResultToDrive}
            showStatus={false}
            showOcr={ocrStarted}
            showMatches={compareStarted}
            showFinal={compareStarted}
            onPreviewClick={(file) =>
              setPreview({ url: file.previewUrl || '', name: file.filename })
            }
          />
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          {/* filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <select
                value={filter.status || ''}
                onChange={(e) =>
                  setFilter({ ...filter, status: (e.target.value as any) || undefined })
                }
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
              <button
                onClick={exportCsvData}
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              >
                Export CSV
              </button>
            </div>
          </div>

          <ProcessingTable
            files={rows}
            onUpdateResult={updateResult}
            onRetryFile={() => {}}
            showStatus
            showOcr
            showMatches
            showFinal
            onPreviewClick={(file) =>
              setPreview({ url: file.previewUrl || '', name: file.filename })
            }
          />

          {rows.some((r) => r.status === 'formatted') && (
            <div className="mt-4">
              <button
                onClick={async () => {
                  for (const r of rows) {
                    if (!r.originalFile) continue;
                    await uploadResultToDrive(r.id);
                  }
                  setStep(2);
                }}
                className="w-full sm:w-auto inline-flex items-center px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Upload to Drive
              </button>
            </div>
          )}

          {preview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-white rounded shadow-lg p-3 max-w-3xl w-full">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-900">{preview.name}</h3>
                  <button
                    className="text-sm text-gray-600"
                    onClick={() => setPreview(null)}
                  >
                    Close
                  </button>
                </div>
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-[80vh] w-auto mx-auto object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
    </div>
  );
};
