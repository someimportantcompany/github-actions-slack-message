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
  stats: { modules: false },
  externals: [ 'aws-sdk' ],
  mode: 'production',
  performance: { hints: false },
  optimization: { minimize: false },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.SERVER_ENV': JSON.stringify('WEBPACK'),
    }),
  ],
};
