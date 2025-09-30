import React from 'react';
import { Save, Download, RefreshCw, Trash2, Filter } from 'lucide-react';
import { ProcessingTableRow } from '../types';

interface ActionBarProps {
  files: ProcessingTableRow[];
  onSaveResults: () => Promise<boolean>;
  onClearFiles: () => void;
  onExport?: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  files,
  onSaveResults,
  onClearFiles,
  onExport
}) => {
  const [saving, setSaving] = React.useState(false);
  
  const approvedCount = files.filter(f => f.result?.approved).length;
  const completedCount = files.filter(f => f.status === 'uploaded_to_drive').length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const processingCount = files.length - completedCount - failedCount;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveResults();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Stats */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Processing: {processingCount}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">Completed: {completedCount}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-600">Failed: {failedCount}</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-gray-600">Approved: {approvedCount}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Filter Button */}
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>

          {/* Export Button */}
          {onExport && (
            <button
              onClick={onExport}
              disabled={files.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          )}

          {/* Clear All Button */}
          <button
            onClick={onClearFiles}
            disabled={files.length === 0}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </button>

          {/* Save Results Button */}
          <button
            onClick={handleSave}
            disabled={approvedCount === 0 || saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-900 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save to Drive ({approvedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Processing Progress</span>
            <span>{Math.round((completedCount / files.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-red-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / files.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};