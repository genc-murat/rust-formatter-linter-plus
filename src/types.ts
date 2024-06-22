export interface RustError {
    filePath: string;
    line: number;
    column: number;
    severity: string;
    message: string;
}