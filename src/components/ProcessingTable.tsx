import React from "react";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit3,
  ChevronDown,
  ChevronRight,
  Upload,
} from "lucide-react";
import { ProcessingTableRow, CorrectionStatus, WineMatch } from "../types";

interface ProcessingTableProps {
  files: ProcessingTableRow[];
  onUpdateResult: (fileId: string, updates: any) => void;
  onRetryFile: (fileId: string) => void;
  showStatus?: boolean;
  showOcr?: boolean;
  showMatches?: boolean;
  showFinal?: boolean;
  onPreviewClick?: (file: ProcessingTableRow) => void;
  onUploadToDrive?: (fileId: string) => Promise<boolean>;
  className?: string; // ✅ allow external styling
}

/** Centralized status config */
const STATUS_CONFIG = {
  uploaded: {
    label: "Uploaded",
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    badge: "bg-blue-100 text-blue-800",
  },
  ocr_done: {
    label: "OCR Complete",
    icon: <Clock className="h-4 w-4 text-yellow-500" />,
    badge: "bg-yellow-100 text-yellow-800",
  },
  llm_done: {
    label: "Analysis Complete",
    icon: <Eye className="h-4 w-4 text-purple-500" />,
    badge: "bg-purple-100 text-purple-800",
  },
  formatted: {
    label: "Formatted",
    icon: <Edit3 className="h-4 w-4 text-indigo-500" />,
    badge: "bg-indigo-100 text-indigo-800",
  },
  uploaded_to_drive: {
    label: "Saved to Drive",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
    badge: "bg-green-100 text-green-800",
  },
  failed: {
    label: "Failed",
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    badge: "bg-red-100 text-red-800",
  },
  unknown: {
    label: "Unknown",
    icon: <Clock className="h-4 w-4 text-gray-500" />,
    badge: "bg-gray-100 text-gray-800",
  },
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.unknown;
  return config.icon;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.unknown;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${config.badge}`}
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
};

const WineMatchSelector: React.FC<{
  matches: WineMatch[];
  selectedOption: string;
  correctionStatus: CorrectionStatus;
  onUpdate: (updates: {
    selectedOption: string;
    correctionStatus?: CorrectionStatus;
  }) => void;
  name: string;
  needsReview?: boolean;
}> = ({
  matches,
  selectedOption,
  correctionStatus,
  onUpdate,
  name,
  needsReview,
}) => {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!selectedOption || selectedOption === "") {
      if (needsReview) {
        onUpdate({ selectedOption: "NHR", correctionStatus: "NHR" });
      } else if (matches && matches.length > 0) {
        onUpdate({ selectedOption: matches[0].option });
      }
    }
  }, [matches, selectedOption, needsReview, onUpdate]);

  const nhrOptions = [
    { value: "search_failed", label: "Search Failed" },
    { value: "ocr_failed", label: "OCR Failed" },
    { value: "manual_rejection", label: "Manual Rejection" },
    { value: "others", label: "Other" },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {matches.map((match, index) => (
          <div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name={name}
                value={match.option}
                checked={selectedOption === match.option}
                onChange={() => onUpdate({ selectedOption: match.option })}
                className="mt-1 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-base font-medium text-gray-900">
                    {match.option}
                  </p>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Score:{" "}
                    {isNaN(match.score as any) ? "—" : match.score.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                  className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 mt-1"
                >
                  {expandedIndex === index ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span>Details</span>
                </button>
                {expandedIndex === index && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    {match.reason}
                  </div>
                )}
              </div>
            </label>
          </div>
        ))}
      </div>

      {/* NHR Option */}
      <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="radio"
            name={name}
            value="NHR"
            checked={selectedOption === "NHR"}
            onChange={() =>
              onUpdate({ selectedOption: "NHR", correctionStatus: "NHR" })
            }
            className="mt-1 h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">
              NHR (Need Human Review)
            </p>
            {selectedOption === "NHR" && (
              <div className="mt-2">
                <select
                  value={correctionStatus || "NHR"}
                  onChange={(e) =>
                    onUpdate({
                      selectedOption: "NHR",
                      correctionStatus: e.target.value as CorrectionStatus,
                    })
                  }
                  className="block w-full text-sm border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="NHR">Select reason</option>
                  {nhrOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};

export const ProcessingTable: React.FC<ProcessingTableProps> = ({
  files,
  onUpdateResult,
  onRetryFile,
  showStatus = true,
  showOcr = true,
  showMatches = true,
  showFinal = true,
  onPreviewClick,
  onUploadToDrive,
  className,
}) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden ${className || ""}`}
    >
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="min-w-full divide-y divide-gray-200 text-base">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                File
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                OCR Text
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Wine Matches
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Final Output
              </th>
              <th className="px-6 py-5 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50">
                {/* File Info */}
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <StatusIcon status={file.status} />
                    <div>
                      <p className="text-base font-medium text-gray-900">
                        {file.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Preview */}
                <td className="px-6 py-5 whitespace-nowrap">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt={`Preview of ${file.filename}`}
                      className="h-14 w-14 object-cover rounded border cursor-pointer"
                      onClick={() => onPreviewClick && onPreviewClick(file)}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-6 py-5 whitespace-nowrap">
                  {showStatus ? (
                    <>
                      <StatusBadge status={file.status} />
                      {file.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">
                          {file.errorMessage}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* OCR Text */}
                <td className="px-6 py-5">
                  <div className="max-w-sm">
                    {showOcr && file.result?.ocrText ? (
                      <div className="text-sm text-gray-900 whitespace-pre-wrap max-h-60 overflow-auto border border-gray-200 rounded-md bg-gray-50 p-2">
                        {file.result.ocrText}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        {showOcr ? "Processing..." : "—"}
                      </span>
                    )}
                  </div>
                </td>

                {/* Matches */}
                <td className="px-6 py-5">
                  <div className="max-w-md">
                    {showMatches &&
                    file.result?.topMatches &&
                    file.result.topMatches.length > 0 ? (
                      <WineMatchSelector
                        matches={file.result.topMatches}
                        selectedOption={file.result.selectedOption}
                        correctionStatus={file.result.correctionStatus}
                        onUpdate={(updates) => onUpdateResult(file.id, updates)}
                        name={`match-${String(file.id).replace(
                          /[^a-zA-Z0-9_-]/g,
                          ""
                        )}`}
                        needsReview={file.result.needsReview}
                      />
                    ) : (
                      <span className="text-sm text-gray-400">
                        {showMatches ? "Analyzing..." : "—"}
                      </span>
                    )}
                  </div>
                </td>

                {/* Final Output */}
                <td className="px-6 py-5">
                  <div className="max-w-sm">
                    <div className="text-sm text-gray-900 whitespace-pre-wrap max-h-60 overflow-auto border border-gray-200 rounded-md bg-gray-50 p-2">
                      {showFinal ? file.result?.finalOutput || "" : ""}
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex space-x-2">
                    {file.status === "failed" && (
                      <button
                        onClick={() => onRetryFile(file.id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Retry
                      </button>
                    )}
                    {file.status === "formatted" && onUploadToDrive && (
                      <button
                        onClick={() => onUploadToDrive(file.id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Save to Drive
                      </button>
                    )}
                    {file.status === "uploaded_to_drive" && (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-700">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Uploaded
                        </span>
                        {file.driveLinks?.target && (
                          <a
                            href={file.driveLinks.target}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-600 hover:text-blue-800"
                          >
                            View in Drive
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
