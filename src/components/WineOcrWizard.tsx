import React, { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  Loader2,
  Play,
  StopCircle,
  HardDrive,
  X,
  RefreshCw,
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { ProcessingTable } from "./ProcessingTable";
import {
  useWineOcr,
  TIME_PER_IMAGE_SECONDS,
  formatTime,
} from "../hooks/useWineOcr";
import { GoogleSignIn } from "./GoogleSignIn";
import { useAuth } from "../hooks/useAuth";
import { useDrive } from "../hooks/useDrive";

export const WineOcrWizard: React.FC = () => {
  const { user } = useAuth();
  const { state: drive, connectDrive } = useDrive();
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
    setFilter,
    handleUpload,
    runOcr,
    runCompare,
    updateResult,
    cancel,
    uploadToDriveAndShopify,
    refreshShopify,
    reset,
  } = useWineOcr();

  const mustSignIn = !user;
  const mustLinkDrive = user && !drive.linked;

  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll handler
  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Watch for compare completion
  useEffect(() => {
    if (compareLocked && !compareLoading) {
      setTimeout(scrollToResults, 100); // Small delay to ensure content is rendered
    }
  }, [compareLocked, compareLoading]);

  return (
    <div className="space-y-8">
      {/* Sticky Header */}
      {/* <header className="sticky top-0 z-50 w-full bg-white shadow p-4 text-center text-2xl font-bold">
        Wine Label Processor
      </header> */}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 rounded-md border border-green-400 bg-green-100 text-green-700">
          ✅ {successMessage}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-md border border-red-400 bg-red-100 text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Drive Connection + Refresh Shopify */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <HardDrive
            className={drive.linked ? "text-green-500" : "text-red-500"}
            size={20}
          />
          <span
            className={`text-sm font-medium ${
              drive.linked ? "text-green-600" : "text-red-600"
            }`}
          >
            {drive.linked
              ? "Connected to Google Drive"
              : "Not Connected to Google Drive"}
          </span>
        </div>

        <div>
          <button
            onClick={refreshShopify}
            disabled={refreshing || ocrStarted}
            className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{refreshing ? "Refreshing..." : "Refresh Shopify Data"}</span>
          </button>
        </div>
      </div>

      {refreshResult && (
        <div className="text-sm text-gray-700 bg-green-50 border border-green-200 p-2 rounded">
          {refreshResult}
        </div>
      )}

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`${
            step >= 2 ? "border-green-600 bg-green-50" : "border-gray-200"
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">1. Upload</p>
        </div>
        <div
          className={`${
            step >= 3 ? "border-green-600 bg-green-50" : "border-gray-200"
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">2. OCR</p>
        </div>
        <div
          className={`${
            step >= 4 ? "border-green-600 bg-green-50" : "border-gray-200"
          } p-3 rounded border`}
        >
          <p className="text-sm font-medium">3. Review</p>
        </div>
      </div>

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
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 disabled:opacity-50"
              >
                {drive.ensuring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <HardDrive className="h-4 w-4" />
                )}
                <span>{drive.ensuring ? "Connecting..." : "Connect Drive"}</span>
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
          {allRows.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    Processing {allRows.length}{" "}
                    {allRows.length === 1 ? "image" : "images"}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Estimated time:{" "}
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
                    ? "bg-white text-gray-700 border border-gray-300"
                    : "bg-green-600 text-white hover:bg-green-700"
                } disabled:opacity-50`}
              >
                {ocrLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {ocrLocked ? "OCR Complete" : "Run OCR"}
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
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-white text-gray-700 border border-gray-300"
                } disabled:opacity-50`}
              >
                {compareLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {compareLocked ? "Compared" : "Compare"}
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
              {ocrLoading ? "Running OCR..." : "Comparing matches..."}
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
            showStatus={false}
            showOcr={ocrStarted}
            showMatches={compareStarted}
            showFinal={compareStarted}
            onPreviewClick={(file) =>
              setSelectedImage({
                url: file.previewUrl || "",
                name: file.filename,
              })
            }
            className="text-sm md:text-base"
          />
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4" ref={resultsRef}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <select
                value={filter.status || ""}
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
                  className="h-4 w-4 text-green-600"
                />
                <span>Needs Review</span>
              </label>
              <input
                type="text"
                placeholder="Search..."
                value={filter.search || ""}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="text-sm border-gray-300 rounded px-2 py-1"
              />
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
              setSelectedImage({
                url: file.previewUrl || "",
                name: file.filename,
              })
            }
            autoScroll={compareLocked && !compareLoading}
          />

          {(rows.some((r) => r.status === "formatted") || successMessage) && (
            <div className="mt-4">
              {!successMessage ? (
                <button
                  onClick={async () => {
                    const selections = rows
                      .filter((r) => r.status === "formatted")
                      .map((r) => {
                        const correction = r.result?.correctionStatus?.toLowerCase?.();
                        const allowedReasons = [
                          "search_failed",
                          "ocr_failed",
                          "manual_rejection",
                          "others",
                        ] as const;

                        // ✅ Explicit target decision:
                        // manual override > needsReview > output
                        const target: "nhr" | "output" =
                          (r.result as any)?.finalTarget === "nhr"
                            ? "nhr"
                            : r.result?.needsReview
                            ? "nhr"
                            : "output";

                        const nhr_reason =
                          target === "nhr"
                            ? allowedReasons.includes(correction as any)
                              ? (correction as (typeof allowedReasons)[number])
                              : "others"
                            : undefined;

                        return {
                          image: r.serverFilename || r.filename,
                          selected_name:
                            r.result?.finalOutput ||
                            r.result?.selectedOption ||
                            r.filename,
                          target,
                          nhr_reason,
                          gid: (r.result as any)?.validatedGid,
                        };
                      });

                    console.log("🚀 Uploading selections payload:", selections);

                    try {
                      await uploadToDriveAndShopify(selections);
                    } catch (err) {
                      console.error("❌ Upload failed:", err);
                      alert("Upload failed, check console for details.");
                    }
                  }}
                  disabled={globalUploading}
                  className="w-full sm:w-auto inline-flex items-center px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {globalUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {globalUploading ? "Uploading..." : "Upload to Drive & Shopify"}
                </button>
              ) : (
                <div className="flex flex-col space-y-2">
                  <p className="text-green-700 text-sm">{successMessage}</p>
                  <button
                    onClick={() => reset()}
                    className="w-auto inline-flex items-center px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs"
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
