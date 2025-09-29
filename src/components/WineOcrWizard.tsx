import React, { useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Play,
  StopCircle,
  HardDrive,
  X,
  RefreshCw,
} from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { ProcessingTable } from './ProcessingTable';
import {
  useWineOcr,
  TIME_PER_IMAGE_SECONDS,
  formatTime,
} from '../hooks/useWineOcr';
import { GoogleSignIn } from './GoogleSignIn';
import { useAuth } from '../hooks/useAuth';
import { useDrive } from '../hooks/useDrive';

export const WineOcrWizard: React.FC = () => {
  const { user } = useAuth();
  const { state: drive, connectDrive } = useDrive();
  const [preview, setPreview] = React.useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const {
    step,
    rows,
    allRows,
    uploading,
    globalUploading,
    successMessage,
    refreshing,
    refreshResult,
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
    exportCsvData,
    uploadToDriveAndShopify,
    refreshShopify,
    reset,
  } = useWineOcr();

  const mustSignIn = !user;
  const mustLinkDrive = user && !drive.linked;

  return (
    <div className="space-y-8">
      {/* Drive Connection + Refresh Shopify */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <HardDrive
            className={drive.linked ? 'text-green-500' : 'text-red-500'}
            size={20}
          />
          <span
            className={`text-sm font-medium ${
              drive.linked ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {drive.linked
              ? 'Connected to Google Drive'
              : 'Not Connected to Google Drive'}
          </span>
        </div>

        {/* Refresh Shopify Cache */}
        <div>
          <button
            onClick={refreshShopify}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{refreshing ? 'Refreshing...' : 'Refresh Shopify Cache'}</span>
          </button>
        </div>
      </div>

      {refreshResult && (
        <div className="text-sm text-gray-700 bg-blue-50 border border-blue-200 p-2 rounded">
          {refreshResult}
        </div>
      )}

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`${
            step >= 2 ? 'border-red-600 bg-red-50' : 'border-gray-200'
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">1. Upload</p>
        </div>
        <div
          className={`${
            step >= 3 ? 'border-red-600 bg-red-50' : 'border-gray-200'
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">2. OCR</p>
        </div>
        <div
          className={`${
            step >= 4 ? 'border-red-600 bg-red-50' : 'border-gray-200'
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">3. Review</p>
        </div>
      </div>

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
              <p className="text-sm text-red-700 mb-2">
                Sign in first to proceed
              </p>
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
            disabled={!!(uploading || mustSignIn || mustLinkDrive)}
            onPreviewFile={(file) =>
              setPreview({ url: URL.createObjectURL(file), name: file.name })
            }
          />

          {uploading && (
            <div className="mt-3 text-sm text-gray-700 inline-flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading
              images...
            </div>
          )}
          {uploadMs != null && !uploading && (
            <div className="mt-2 text-xs text-gray-500">
              Upload completed in {(uploadMs / 1000).toFixed(2)} s
            </div>
          )}
        </div>
      )}

      {/* Shared Uploaded Images Grid (available in all steps >= 2) */}
      {step >= 2 && allRows.length > 0 && (
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Uploaded Images ({allRows.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {allRows.map((file) => (
              <div
                key={file.id}
                className="relative cursor-pointer"
                onClick={() =>
                  file.previewUrl &&
                  setSelectedImage({
                    url: file.previewUrl,
                    name: file.filename,
                  })
                }
              >
                <img
                  src={file.previewUrl}
                  alt={file.filename}
                  className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200 hover:border-red-500 transition-colors"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    Click to preview
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 3 && (
        <div className="space-y-4">
          {allRows.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    Processing {allRows.length}{' '}
                    {allRows.length === 1 ? 'image' : 'images'}
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    Estimated time:{' '}
                    {formatTime(allRows.length * TIME_PER_IMAGE_SECONDS)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-x-2">
              <button
                onClick={runOcr}
                disabled={ocrLoading || allRows.length === 0 || ocrLocked}
                className={`inline-flex items-center px-3 py-2 rounded ${
                  ocrLocked
                    ? 'bg-white text-gray-700 border border-gray-300'
                    : 'bg-red-900 text-white'
                } disabled:opacity-50`}
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
                disabled={
                  compareLoading ||
                  allRows.length === 0 ||
                  !canRunCompare ||
                  compareLocked
                }
                className={`inline-flex items-center px-3 py-2 rounded ${
                  ocrLocked && !compareLocked
                    ? 'bg-red-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                } disabled:opacity-50`}
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
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
              setSelectedImage({ url: file.previewUrl || '', name: file.filename })
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
                  setFilter({
                    ...filter,
                    status: (e.target.value as any) || undefined,
                  })
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
                  onChange={(e) =>
                    setFilter({ ...filter, needsReview: e.target.checked })
                  }
                  className="h-4 w-4 text-red-600"
                />
                <span>Needs Review</span>
              </label>
              <input
                type="text"
                placeholder="Search..."
                value={filter.search || ''}
                onChange={(e) =>
                  setFilter({ ...filter, search: e.target.value })
                }
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
              setSelectedImage({ url: file.previewUrl || '', name: file.filename })
            }
          />

          {(rows.some((r) => r.status === 'formatted') || successMessage) && (
            <div className="mt-4">
              {!successMessage ? (
                <button
                  onClick={async () => {
                    const selections = rows
                      .filter((r) => r.status === 'formatted')
                      .map((r) => {
                        const correction = r.result?.correctionStatus?.toLowerCase?.();
                        const allowedReasons = [
                          'search_failed',
                          'ocr_failed',
                          'manual_rejection',
                          'others',
                        ] as const;

                        const nhr_reason = r.result?.needsReview
                          ? (allowedReasons.includes(correction as any)
                              ? (correction as typeof allowedReasons[number])
                              : 'others')
                          : undefined;

                        return {
                          image: r.serverFilename || r.filename,
                          selected_name:
                            r.result?.finalOutput ||
                            r.result?.selectedOption ||
                            r.filename,
                          target: (r.result?.needsReview
                            ? 'nhr'
                            : 'output') as 'nhr' | 'output',
                          nhr_reason,
                          gid: (r.result as any)?.validatedGid,
                        };
                      });

                    await uploadToDriveAndShopify(selections);
                  }}
                  disabled={globalUploading}
                  className="w-full sm:w-auto inline-flex items-center px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {globalUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {globalUploading ? 'Uploading...' : 'Upload to Drive & Shopify'}
                </button>
              ) : (
                <div className="flex flex-col space-y-2">
                  <p className="text-green-700 text-sm">{successMessage}</p>
                  <button
                    onClick={() => reset()}
                    className="w-full sm:w-auto inline-flex items-center px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Process Another Batch
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 p-4">
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="max-h-[80vh] mx-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
