const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
	entry: './src/index.ts',
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
	},
	target: 'es2020', // use require() & use NodeJs CommonJS style
	externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
	externalsPresets: {
		node: true, // in order to ignore built-in modules like path, fs, etc.
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		libraryTarget: 'commonjs2',
		filename: 'index.js',
		chunkFormat: 'module',
		chunkFilename: '[id].js',
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.(j|t)sx$/,
				exclude: /(node_modules|\.(test|spec))/,
				use: {
					loader: 'babel-loader',
				},
			},
		],
	},
};
