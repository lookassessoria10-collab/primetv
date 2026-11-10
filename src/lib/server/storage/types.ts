/**
 * Abstração de armazenamento do conteúdo. Hoje: GitHub (produção) e disco local (desenvolvimento).
 * Uma integração futura (ex.: Cloudflare R2 para mídias) implementa a mesma interface
 * sem alterar painel ou player.
 */

export interface RepoFile {
  /** Caminho relativo à raiz do repositório. */
  path: string;
  /** Conteúdo; `null` remove o arquivo. */
  content: Uint8Array | string | null;
}

export interface CommitResult {
  commit: string;
  url?: string;
}

export interface ListedFile {
  path: string;
  size: number;
}

export type DeployState = "pending" | "success" | "failure" | "unknown";

export interface DeployStatus {
  state: DeployState;
  description?: string;
  targetUrl?: string;
  environmentUrl?: string;
}

export interface ContentStorage {
  readonly kind: "github" | "local";
  describe(): { kind: "github" | "local"; repo?: string; branch?: string; commitUrlBase?: string };
  /** Identificador do estado atual (SHA do commit no GitHub). */
  head(): Promise<string>;
  readText(path: string, ref?: string): Promise<string | null>;
  readBinary(path: string, ref?: string): Promise<Uint8Array | null>;
  listFiles(prefix: string, ref?: string): Promise<ListedFile[]>;
  /**
   * Grava todos os arquivos em um único commit.
   * Com `parent`, falha com HeadMovedError se o ramo tiver avançado desde a leitura.
   */
  commit(files: RepoFile[], message: string, parent?: string): Promise<CommitResult>;
  deployStatus(commit: string): Promise<DeployStatus>;
}

export class HeadMovedError extends Error {
  constructor() {
    super("O repositório recebeu outra gravação durante a operação.");
  }
}

export class StorageError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

const ALLOWED_PATHS = [
  /^data\/(store|draft)\.json$/,
  /^public\/media\/[a-z0-9][a-z0-9_/-]*\.(webp|jpe?g|png|avif|mp4|webm)$/i,
  /^archive\/originals\/[a-z0-9][a-z0-9_/-]*\.(webp|jpe?g|png|avif|heic|heif|tiff?|mp4|webm|mov)$/i,
];

/** Impede gravações fora das pastas de conteúdo. */
export function assertWritablePath(p: string) {
  if (!p || p.includes("..") || p.includes("\\") || p.startsWith("/") || p.includes("//") || !ALLOWED_PATHS.some((r) => r.test(p))) {
    throw new StorageError(`Caminho não permitido para gravação: ${p}`, 400);
  }
}

/** Leitura restrita às pastas de conteúdo. */
export function assertReadablePath(p: string) {
  if (!p || p.includes("..") || p.includes("\\") || p.startsWith("/")) throw new StorageError("Caminho inválido.", 400);
  if (!(p.startsWith("public/media/") || p.startsWith("archive/originals/") || p.startsWith("data/"))) {
    throw new StorageError("Caminho fora das pastas de conteúdo.", 400);
  }
}
