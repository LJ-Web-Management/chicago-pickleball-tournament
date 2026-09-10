const { dispatch } = require('../lib/router');

module.exports = (req, res) => dispatch(req, res);

// Raised above the 1mb default so an admin can upload a rules PDF (base64
// in the JSON body runs ~33% larger than the raw file).
module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
