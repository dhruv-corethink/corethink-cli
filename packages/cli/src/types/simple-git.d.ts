declare module 'simple-git' {
  export interface CommitResult {
    author: null | { email: string; name: string };
    branch: string;
    commit: string;
    root: boolean;
    summary: { changes: number; insertions: number; deletions: number };
  }

  export interface SimpleGit {
    raw(args: string[]): Promise<string>;
    raw(...args: string[]): Promise<string>;
    init(bare?: boolean, options?: Record<string, string | null>): Promise<string>;
    add(files: string | string[]): Promise<string>;
    commit(message: string, options?: Record<string, string | null>): Promise<CommitResult>;
    status(): Promise<any>;
    log(): Promise<any>;
    checkout(branch: string): Promise<string>;
    checkoutLocalBranch(branch: string): Promise<string>;
    branch(): Promise<any>;
    branchLocal(): Promise<any>;
    fetch(remote?: string, branch?: string): Promise<string>;
    pull(remote?: string, branch?: string): Promise<string>;
    push(remote?: string, branch?: string): Promise<string>;
    diff(): Promise<string>;
    diffSummary(): Promise<any>;
    show(commit?: string): Promise<string>;
    clean(mode: string, options?: string | string[]): Promise<string>;
    reset(mode?: string, commit?: string): Promise<string>;
    tag(args?: string[]): Promise<string>;
    tags(): Promise<any>;
    remote(...args: string[]): Promise<any>;
    stashList(): Promise<any>;
    stash(): Promise<string>;
    stashPop(): Promise<string>;
    stashApply(): Promise<string>;
    subModule(...args: string[]): Promise<string>;
    submoduleAdd(repo: string, path: string): Promise<string>;
    submoduleInit(...args: string[]): Promise<string>;
    submoduleUpdate(...args: string[]): Promise<string>;
    merge(...args: string[]): Promise<string>;
    mergeFromTo(branchA: string, branchB: string): Promise<string>;
    revert(commit: string): Promise<string>;
    cherryPick(commit: string): Promise<string>;
    revparse(commit: string): Promise<string>;
    catFile(options: string[]): Promise<string>;
    grep(pattern: string): Promise<any>;
    hashObject(filePath: string): Promise<string>;
    updateServerInfo(): Promise<string>;
    checkIgnore(paths: string[]): Promise<string[]>;
    checkIsRepo(action?: CheckRepoActions): Promise<boolean>;
    customBinary(command: string): SimpleGit;
    env(env: { [key: string]: string }): SimpleGit;
    silent(silent?: boolean): SimpleGit;
    outputHandler(handler: (...args: any[]) => void): SimpleGit;
    progress(handler: (...args: any[]) => void): SimpleGit;
  }

  export enum CheckRepoActions {
    BARE = 'bare',
    IN_TREE = 'in_tree',
    IS_REPO_ROOT = 'root'
  }

  export function simpleGit(basePath?: string, options?: any): SimpleGit;
  export default simpleGit;
}


