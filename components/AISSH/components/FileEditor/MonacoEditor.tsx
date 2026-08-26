import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { FileSession } from '../../types';
import { Button } from '../../common/Button';
import { Save, X, Download, Copy } from 'lucide-react';

interface MonacoEditorProps {
  session: FileSession;
  onSave: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onDownload: (sessionId: string) => void;
  onBackup: (sessionId: string) => void;
  onChange: (sessionId: string, content: string) => void;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  session,
  onSave,
  onClose,
  onDownload,
  onBackup,
  onChange
}) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Initialize Editor
  useEffect(() => {
    if (editorContainerRef.current) {
      // Define custom theme
      monaco.editor.defineTheme('ai-ssh-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6a737d' },
          { token: 'keyword', foreground: 'f97583' },
          { token: 'string', foreground: '9ecbff' },
          { token: 'number', foreground: '79b8ff' },
        ],
        colors: {
          'editor.background': '#11161d',
          'editor.foreground': '#c9d1d9',
          'editorCursor.foreground': '#00f3ff',
          'editor.lineHighlightBackground': '#1a2129',
          'editor.selectionBackground': 'rgba(0, 243, 255, 0.2)',
          'editor.inactiveSelectionBackground': 'rgba(0, 243, 255, 0.1)',
          'minimap.background': '#010409',
          'minimap.selectionHighlight': '#00f3ff'
        }
      });

      editorRef.current = monaco.editor.create(editorContainerRef.current, {
        value: session.content,
        language: session.language || 'plaintext',
        theme: 'ai-ssh-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      });

      // Handle content changes
      editorRef.current.onDidChangeModelContent(() => {
        const value = editorRef.current?.getValue();
        if (value !== undefined) {
           onChange(session.id, value);
        }
      });

      // Key bindings
      editorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave(session.id);
      });
    }

    return () => {
      editorRef.current?.dispose();
    };
  }, []); // Run once on mount

  // Update editor content when session changes (e.g. switching tabs)
  // But be careful not to overwrite user input if they are typing.
  // Ideally, the editor instance should be preserved or we should check if content is different.
  // Since we create a new editor on mount, and the session prop changes when we switch files...
  // Wait, if we switch files, this component might re-mount if key changes.
  // If key doesn't change, we need to update model.
  
  useEffect(() => {
    if (editorRef.current && session) {
      const model = editorRef.current.getModel();
      if (model) {
        // Only update editor value if it's different from the store (e.g. after save or external update)
        // This prevents cursor jumping while typing
        const currentValue = model.getValue();
        if (currentValue !== session.content) {
          editorRef.current.setValue(session.content);
        }
        
        // Ensure language is always in sync
        if (session.language) {
          monaco.editor.setModelLanguage(model, session.language);
        }
      }
    }
  }, [session.content, session.language]); // Monitor content and language changes

  // We need to handle value updates back to store
  // I'll add an onChange prop to the interface and use it.
  
  return (
    <div className="flex flex-col h-full bg-[#11161d]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1a2129]">
        <div className="flex items-center space-x-2 text-sm text-sci-text">
          <span className="opacity-50">{session.filePath}</span>
          {session.isModified && <span className="text-sci-yellow text-xs mx-2">● 已修改</span>}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onSave(session.id)}
            disabled={!session.isModified}
            title="保存 (Cmd+S)"
          >
            <Save size={16} className={session.isModified ? "text-sci-cyan" : ""} />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onDownload(session.id)}
            title="下载"
          >
            <Download size={16} />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onBackup(session.id)}
            title="备份"
          >
            <Copy size={16} />
          </Button>
          <div className="w-px h-4 bg-white/10 mx-2" />
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onClose(session.id)}
            title="关闭"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={editorContainerRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
