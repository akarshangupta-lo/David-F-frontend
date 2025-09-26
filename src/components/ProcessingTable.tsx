import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Eye,
  Edit3,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { ProcessingTableRow, CorrectionStatus, WineMatch } from '../types';

interface ProcessingTableProps {
  files: ProcessingTableRow[];
  onUpdateResult: (fileId: string, updates: any) => void;
  onRetryFile: (fileId: string) => void;
  onUploadToDrive?: (fileId: string) => void;
  showStatus?: boolean;
  showOcr?: boolean;
  showMatches?: boolean;
  showFinal?: boolean;
  onPreviewClick?: (file: ProcessingTableRow) => void;
}

const StatusIcon: React.FC<{ status: string; error?: string }> = ({ status, error: _error }) => {
  switch (status) {
    case 'uploaded':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'ocr_done':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'llm_done':
      return <Eye className="h-4 w-4 text-purple-500" />;
    case 'formatted':
      return <Edit3 className="h-4 w-4 text-indigo-500" />;
    case 'uploaded_to_drive':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig = {
    uploaded: { label: 'Uploaded', className: 'bg-blue-100 text-blue-800' },
    ocr_done: { label: 'OCR Complete', className: 'bg-yellow-100 text-yellow-800' },
    llm_done: { label: 'Analysis Complete', className: 'bg-purple-100 text-purple-800' },
    formatted: { label: 'Formatted', className: 'bg-indigo-100 text-indigo-800' },
    uploaded_to_drive: { label: 'Saved to Drive', className: 'bg-green-100 text-green-800' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || 
    { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
};

const WineMatchSelector: React.FC<{
  matches: WineMatch[];
  selectedOption: string;
  correctionStatus: CorrectionStatus;
  onSelectionChange: (option: string) => void;
  onCorrectionStatusChange: (status: CorrectionStatus) => void;
  name: string;
  needsReview?: boolean;
}> = ({ matches, selectedOption, correctionStatus, onSelectionChange, onCorrectionStatusChange, name, needsReview }) => {
  const [expanded, setExpanded] = React.useState(false);

  // Preselect highest score if nothing selected yet
  React.useEffect(() => {
    if (!selectedOption || selectedOption === '') {
      if (needsReview) {
        onSelectionChange('NHR');
      } else if (matches && matches.length > 0) {
        onSelectionChange(matches[0].option);
      }
    }
  }, [matches, selectedOption, onSelectionChange, needsReview]);

  const nhrOptions = [
    { value: 'search_failed', label: 'Search Failed' },
    { value: 'ocr_failed', label: 'OCR Failed' },
    { value: 'manual_rejection', label: 'Manual Rejection' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-3">
      {/* Wine Matches */}
      <div className="space-y-2">
        {matches.map((match, index) => (
          <div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name={name}
                value={match.option}
                checked={selectedOption === match.option}
                onChange={(e) => onSelectionChange(e.target.value)}
                className="mt-1 h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{match.option}</p>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Score: {isNaN(match.score as any) ? '—' : match.score.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 mt-1"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>Details</span>
                </button>
                {expanded && (
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
            checked={selectedOption === 'NHR'}
            onChange={(e) => onSelectionChange(e.target.value)}
            className="mt-1 h-4 w-4 text-orange-600 border-gray-300 focus:ring-orange-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">NHR (Need Human Review)</p>
            {selectedOption === 'NHR' && (
              <div className="mt-2">
                <select
                  value={correctionStatus}
                  onChange={(e) => onCorrectionStatusChange(e.target.value as CorrectionStatus)}
                  className="block w-full text-sm border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="NHR">Select reason</option>
                  {nhrOptions.map(option => (
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
  onUploadToDrive,
  showStatus = true,
  showOcr = true,
  showMatches = true,
  showFinal = true,
  onPreviewClick,
}) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No files uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preview
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                OCR Text
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Wine Matches
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Final Output
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {files.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <StatusIcon status={file.status} error={file.errorMessage} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </td>
               <td className="px-6 py-4 whitespace-nowrap">
                 {file.previewUrl ? (
                   <img
                     src={file.previewUrl}
                     alt={file.filename}
                     className="h-12 w-12 object-cover rounded border cursor-pointer"
                     onClick={() => onPreviewClick && onPreviewClick(file)}
                   />
                 ) : (
                   <span className="text-xs text-gray-400">—</span>
                 )}
               </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {showStatus ? (
                    <>
                      <StatusBadge status={file.status} />
                      {file.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{file.errorMessage}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    {showOcr && file.result?.ocrText ? (
                      <div className="text-sm text-gray-900 whitespace-pre-wrap max-h-40 overflow-auto border border-gray-200 rounded-md bg-gray-50 p-2">
                        {file.result.ocrText}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{showOcr ? 'Processing...' : '—'}</span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="max-w-sm">
                    {showMatches && file.result?.topMatches && file.result.topMatches.length > 0 ? (
                      <WineMatchSelector
                        matches={file.result.topMatches}
                        selectedOption={file.result.selectedOption}
                        correctionStatus={file.result.correctionStatus}
                        onSelectionChange={(option) => onUpdateResult(file.id, { selectedOption: option })}
                        onCorrectionStatusChange={(status) => onUpdateResult(file.id, { correctionStatus: status })}
                        name={`match-${file.id}`}
                        needsReview={file.result.needsReview}
                      />
                    ) : (
                      <span className="text-sm text-gray-400">{showMatches ? 'Analyzing...' : '—'}</span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <div className="text-sm text-gray-900 whitespace-pre-wrap max-h-32 overflow-auto border border-gray-200 rounded-md bg-gray-50 p-2">
                      {showFinal ? (file.result?.finalOutput || '') : ''}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    {file.status === 'failed' && (
                      <button
                        onClick={() => onRetryFile(file.id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Retry
                      </button>
                    )}
                    {file.status === 'formatted' && onUploadToDrive && (
                      <button
                        onClick={() => onUploadToDrive(file.id)}
                        className="inline-flex items-center px-3 py-1 border border-blue-300 shadow-sm text-xs font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
                      >
                        Upload to Drive
                      </button>
                    )}
                    {file.status === 'uploaded_to_drive' && (
                      <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-green-700">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Uploaded
                      </span>
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