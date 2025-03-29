/**
 * Configuration for a specification source
 */
export interface SpecSource {
  /** Type of the source (URL, file system, or git repository) */
  type: "url" | "file" | "git";
  /** Location of the source (URL, file path, or git URL) */
  location: string;
  /** Optional authentication configuration */
  auth?: {
    /** Type of authentication */
    type: "basic" | "token" | "oauth2";
    /** Authentication credentials */
    credentials: Record<string, string>;
  };
}

/**
 * Configuration for synchronization
 */
export interface SyncConfig {
  /** List of specification sources to sync from */
  sources: SpecSource[];
  /** Directory where specifications will be stored */
  targetDirectory: string;
  /** Optional interval for automatic synchronization (in milliseconds) */
  syncInterval?: number;
}

/**
 * Result of a synchronization operation
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** When the sync was performed */
  timestamp: Date;
  /** Name of the file that was synced */
  filename: string;
  /** Optional error if sync failed */
  error?: Error;
}

/**
 * Interface for managing synchronization of specifications
 */
export interface ISyncManager {
  /**
   * Synchronize specifications from sources to target directory
   * @param config Configuration for the sync operation
   * @returns Array of results for each synced specification
   */
  sync(config: SyncConfig): Promise<SyncResult[]>;
}
