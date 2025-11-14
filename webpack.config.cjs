const path = require('path');

module.exports = {
  entry: './index.ts',
  target: 'node',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'index.cjs',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    library: {
      type: 'commonjs2',
    },
  },
  externals: {
    'ws': 'commonjs ws',
    'dotenv': 'commonjs dotenv',
    'uuid': 'commonjs uuid',
    'fs': 'commonjs fs',
    'path': 'commonjs path',
    'http': 'commonjs http',
    'url': 'commonjs url',
  },
  optimization: {
    minimize: false,
  },
};