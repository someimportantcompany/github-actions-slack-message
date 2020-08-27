const webpack = require('webpack');

module.exports = {
  entry: {
    index: './index.js',
  },
  output: {
    path: __dirname,
    filename: '[name].dist.js',
  },
  target: 'node',
  context: process.env.PWD,
  // Disable verbose logs
  stats: process.env.NODE_ENV === 'production' ? 'errors-only' : 'normal',
  externals: [ 'aws-sdk' ],
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  performance: {
    // Turn off size warnings for entry points
    hints: false,
  },
  // PERFORMANCE ONLY FOR DEVELOPMENT
  optimization: process.env.NODE_ENV === 'production'
    ? { minimize: false }
    : { splitChunks: false, removeEmptyChunks: false, removeAvailableModules: false },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.SERVER_ENV': JSON.stringify('WEBPACK'),
    }),
  ],
};
