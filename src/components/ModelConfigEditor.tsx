import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, X, Check } from "lucide-react";

export interface ModelConfig {
  name: string;
  url: string;
  key: string;
}

interface ModelConfigEditorProps {
  title: string;
  models: ModelConfig[];
  selectedIndex: number;
  onModelsChange: (models: ModelConfig[], selectedIndex: number) => void;
}

interface ModelItemProps {
  model: ModelConfig;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onUpdate: (model: ModelConfig) => void;
  onDelete: () => void;
}

function ModelItem({
  model,
  isExpanded,
  isSelected,
  onToggle,
  onUpdate,
  onDelete,
}: ModelItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editModel, setEditModel] = useState<ModelConfig>(model);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleUpdate = () => {
    onUpdate(editModel);
  };

  if (isExpanded) {
    return (
      <div className="border border-border-subtle rounded-md bg-surface">
        {/* Expanded header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface-hover"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ChevronDown size={14} className="text-text-muted shrink-0" />
            <span className="text-text-primary text-xs truncate">
              {model.name || "Unnamed Model"}
            </span>
            {isSelected && (
              <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded shrink-0">
                Active
              </span>
            )}
          </div>
        </div>

        {/* Expanded content */}
        <div className="px-3 pb-3 space-y-2 border-t border-border-subtle">
          <div className="pt-2">
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              Name
            </label>
            <input
              type="text"
              value={editModel.name}
              onChange={(e) => setEditModel({ ...editModel, name: e.target.value })}
              onBlur={handleUpdate}
              className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="Model name (e.g., gpt-4)"
            />
          </div>

          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              URL
            </label>
            <input
              type="text"
              value={editModel.url}
              onChange={(e) => setEditModel({ ...editModel, url: e.target.value })}
              onBlur={handleUpdate}
              className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              API Key
            </label>
            <input
              type="password"
              value={editModel.key}
              onChange={(e) => setEditModel({ ...editModel, key: e.target.value })}
              onBlur={handleUpdate}
              className="w-full px-2 py-1 bg-surface border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="sk-..."
            />
          </div>

          {/* Delete button in expanded content */}
          <div className="pt-2 flex justify-end">
            {!showDeleteConfirm ? (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1 px-2 py-1 text-xs text-error hover:bg-error/10 rounded transition-colors"
              >
                <Trash2 size={12} />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelDelete}
                  className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-2 py-1 text-xs text-error hover:bg-error/10 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Collapsed view
  return (
    <div
      className="flex items-center px-3 py-2 border border-border-subtle rounded-md bg-surface cursor-pointer hover:bg-surface-hover"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <ChevronRight size={14} className="text-text-muted shrink-0" />
        <span className="text-text-primary text-xs truncate">
          {model.name || "Unnamed Model"}
        </span>
        {isSelected && (
          <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded shrink-0">
            Active
          </span>
        )}
      </div>
    </div>
  );
}

export default function ModelConfigEditor({
  title,
  models,
  selectedIndex,
  onModelsChange,
}: ModelConfigEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newModel, setNewModel] = useState<ModelConfig>({
    name: "",
    url: "",
    key: "",
  });

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleUpdateModel = (index: number, updatedModel: ModelConfig) => {
    const newModels = [...models];
    newModels[index] = updatedModel;
    onModelsChange(newModels, selectedIndex);
  };

  const handleDeleteModel = (index: number) => {
    const newModels = models.filter((_, i) => i !== index);
    // Adjust selected index if needed
    let newSelectedIndex = selectedIndex;
    if (index === selectedIndex) {
      newSelectedIndex = 0;
    } else if (index < selectedIndex) {
      newSelectedIndex = selectedIndex - 1;
    }
    if (newSelectedIndex >= newModels.length) {
      newSelectedIndex = Math.max(0, newModels.length - 1);
    }
    onModelsChange(newModels, newSelectedIndex);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setNewModel({ name: "", url: "", key: "" });
  };

  const handleSaveNew = () => {
    if (!newModel.name.trim()) return; // Ignore empty names
    const newModels = [...models, newModel];
    onModelsChange(newModels, selectedIndex);
    setIsAdding(false);
    setNewModel({ name: "", url: "", key: "" });
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewModel({ name: "", url: "", key: "" });
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-text-muted text-xs uppercase tracking-wide">{title}</h3>
        {!isAdding && (
          <button
            onClick={handleAddClick}
            className="p-1 text-accent hover:bg-accent-subtle rounded transition-colors"
            title="Add model"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Model list */}
      <div className="space-y-1">
        {models.map((model, index) => (
          <ModelItem
            key={`${model.name}-${index}`}
            model={model}
            isExpanded={expandedIndex === index}
            isSelected={index === selectedIndex}
            onToggle={() => handleToggleExpand(index)}
            onUpdate={(updated) => handleUpdateModel(index, updated)}
            onDelete={() => handleDeleteModel(index)}
          />
        ))}
      </div>

      {/* Add new model form - At bottom */}
      {isAdding && (
        <div className="border border-border-subtle rounded-md bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-primary text-sm font-medium">New Model</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCancelAdd}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
                title="Cancel"
              >
                <X size={14} />
              </button>
              <button
                onClick={handleSaveNew}
                disabled={!newModel.name.trim()}
                className="p-1 text-accent hover:text-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save"
              >
                <Check size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              Name
            </label>
            <input
              type="text"
              value={newModel.name}
              onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
              className="w-full px-2 py-1 bg-surface-secondary border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="Model name (e.g., gpt-4)"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              URL
            </label>
            <input
              type="text"
              value={newModel.url}
              onChange={(e) => setNewModel({ ...newModel, url: e.target.value })}
              className="w-full px-2 py-1 bg-surface-secondary border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">
              API Key
            </label>
            <input
              type="password"
              value={newModel.key}
              onChange={(e) => setNewModel({ ...newModel, key: e.target.value })}
              className="w-full px-2 py-1 bg-surface-secondary border border-border-subtle rounded text-text-primary text-xs focus:outline-none focus:border-accent"
              placeholder="sk-..."
            />
          </div>
        </div>
      )}

      {models.length === 0 && !isAdding && (
        <p className="text-text-disabled text-xs text-center py-4">
          No models configured. Click + to create one.
        </p>
      )}
    </div>
  );
}
