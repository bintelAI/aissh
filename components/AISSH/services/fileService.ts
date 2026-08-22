import { sshManager } from './sshService';
import { FileNode } from '../types';

export class FileService {
  private static instance: FileService;

  private constructor() {}

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  async readFile(serverId: string, filePath: string): Promise<string> {
    // 1. Check file size
    // Use `wc -c < "file"` which is standard and avoids parsing issues across different stat versions
    const sizeCmd = `wc -c < "${filePath}"`;
    const sizeOutput = await sshManager.executeCommand(sizeCmd, serverId);
    
    if (sizeOutput.startsWith('Error:')) {
        throw new Error(sizeOutput);
    }

    const size = parseInt(sizeOutput.trim(), 10);
    const MAX_SIZE = 1024 * 1024; // 1MB limit

    if (!isNaN(size) && size > MAX_SIZE) {
        throw new Error(`FILE_TOO_LARGE:${size}`);
    }

    // Use base64 to avoid encoding issues with special characters
    const command = `cat "${filePath}" | base64`;
    const output = await sshManager.executeCommand(command, serverId);
    
    // The output might contain other text if the command execution logs it, 
    // but sshManager.executeCommand returns the output.
    // We need to clean it up. The executeCommand implementation in sshService
    // returns the raw output.
    
    // If there's an error, the output might start with "Error:".
    if (output.startsWith('Error:')) {
      throw new Error(output);
    }

    try {
      // Clean up whitespace
      const cleanOutput = output.trim();
      // Decode base64 robustly for Unicode support
      const binaryString = atob(cleanOutput);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    } catch (e) {
      console.error('Failed to decode file content:', e);
      throw new Error('Failed to decode file content');
    }
  }

  async writeFile(serverId: string, filePath: string, content: string, onProgress?: (progress: number) => void): Promise<void> {
    // Robust base64 encoding for Unicode support
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    let binary = '';
    const bytes = new Uint8Array(data);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);
    
    await this.writeBase64Chunked(serverId, filePath, base64Content, onProgress);
  }

  /**
   * Helper to write base64 content to a file in chunks to avoid shell command length limits
   */
  private async writeBase64Chunked(
    serverId: string, 
    filePath: string, 
    base64Content: string, 
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const tempPath = `/tmp/ai-ssh-${Date.now()}`;
    // 32KB chunks are safe for most SSH/Shell environments
    const chunkSize = 32 * 1024;
    const totalChunks = Math.ceil(base64Content.length / chunkSize);

    try {
      // 1. Initialize empty temp file
      await sshManager.executeCommand(`> "${tempPath}"`, serverId);

      // 2. Append chunks using printf
      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64Content.slice(i * chunkSize, (i + 1) * chunkSize);
        // Use printf %s to avoid echo interpretation of backslashes or leading dashes
        const appendCmd = `printf "%s" "${chunk}" >> "${tempPath}"`;
        const output = await sshManager.executeCommand(appendCmd, serverId);
        
        if (output.startsWith('Error:')) {
          throw new Error(`Failed to write chunk ${i + 1}/${totalChunks}: ${output}`);
        }

        if (onProgress) {
          onProgress(Math.round(((i + 1) / totalChunks) * 100));
        }
      }

      // 3. Decode temp file and move to target
      // Use base64 -d or openssl base64 -d as fallback if needed, but base64 is standard on Linux/Mac
      const finalizeCmd = `base64 -d < "${tempPath}" > "${filePath}" && rm -f "${tempPath}"`;
      const finalOutput = await sshManager.executeCommand(finalizeCmd, serverId);
      
      if (finalOutput.startsWith('Error:')) {
        throw new Error(`Failed to finalize file write: ${finalOutput}`);
      }
    } catch (error) {
      // Cleanup temp file on error
      await sshManager.executeCommand(`rm -f "${tempPath}"`, serverId).catch(() => {});
      throw error;
    }
  }

  async deleteFile(serverId: string, filePath: string): Promise<void> {
    const command = `rm -rf "${filePath}"`;
    const output = await sshManager.executeCommand(command, serverId);
    if (output.startsWith('Error:')) {
      throw new Error(output);
    }
  }

  async createFile(serverId: string, filePath: string): Promise<void> {
    const command = `touch "${filePath}"`;
    const output = await sshManager.executeCommand(command, serverId);
    if (output.startsWith('Error:')) {
      throw new Error(output);
    }
  }

  async backupFile(serverId: string, filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(new RegExp('[-:T]', 'g'), '').split('.')[0];
    const backupPath = `${filePath}.${timestamp}`;
    const command = `cp "${filePath}" "${backupPath}"`;
    const output = await sshManager.executeCommand(command, serverId);
    if (output.startsWith('Error:')) {
      throw new Error(output);
    }
    return backupPath;
  }

  async uploadFile(serverId: string, path: string, fileName: string, base64Content: string, onProgress?: (progress: number) => void): Promise<void> {
    const fullPath = path.endsWith('/') ? `${path}${fileName}` : `${path}/${fileName}`;
    await this.writeBase64Chunked(serverId, fullPath, base64Content, onProgress);
  }

  async listFiles(serverId: string, path: string): Promise<FileNode[]> {
    // ls -la with specific format
    // using --time-style=+%Y-%m-%d_%H:%M:%S for consistent date parsing if needed
    // but simple parsing as per doc is fine for now.
    // We'll use a safer parsing method if possible, but 'ls -la' is standard.
    const command = `ls -la "${path}"`;
    const output = await sshManager.executeCommand(command, serverId);

    if (output.startsWith('Error:')) {
      throw new Error(output);
    }

    return this.parseLsOutput(output, path);
  }

  private parseLsOutput(output: string, basePath: string): FileNode[] {
    const lines = output.split('\n').filter(line => line && !line.trim().startsWith('total'));
    const files: FileNode[] = [];
    
    // Simple ls -la parser
    // drwxr-xr-x 5 root root 4096 Jan 1 12:00 .
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9) continue;
      
      const permissions = parts[0];
      // parts[1] is links
      const owner = parts[2];
      const group = parts[3];
      const size = parseInt(parts[4], 10);
      // Date is usually parts[5], [6], [7] (Month Day Time/Year)
      // Name starts at parts[8]
      const nameStartIndex = 8;
      const name = parts.slice(nameStartIndex).join(' ');
      
      // Skip . and ..
      if (name === '.' || name === '..') continue;
      
      const isDirectory = permissions.startsWith('d');
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const fullPath = `${cleanBasePath}/${name}`;
      
      files.push({
        id: fullPath,
        name,
        type: isDirectory ? 'folder' : 'file',
        size: isDirectory ? undefined : size,
        permissions,
        owner,
        group,
        path: fullPath
      });
    }
    
    return files.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    });
  }
}

export const fileService = FileService.getInstance();
