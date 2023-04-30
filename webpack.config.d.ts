export const entry: string;
export namespace resolve {
    const extensions: string[];
}
export const target: string;
export const externals: any[];
export namespace externalsPresets {
    const node: boolean;
}
export namespace output {
    const path: string;
    const filename: string;
    const chunkFormat: string;
    const chunkFilename: string;
}
export namespace module {
    const rules: {
        test: RegExp;
        loader: string;
        exclude: RegExp;
    }[];
}
