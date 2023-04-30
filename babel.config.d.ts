export namespace env {
    namespace test {
        const presets: (string | (string | {
            targets: {
                node: string;
            };
        })[] | (string | {
            runtime: string;
        })[])[];
        const plugins: (string | (string | {
            regenerator: boolean;
        })[] | (string | {
            pragma: string;
        })[])[];
    }
}
