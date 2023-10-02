import { NextApiHandler } from 'next';

export const handler: NextApiHandler = async (req, res) => {
	console.log('/api/form-submit', {
		method: req.method,
		headers: req.headers,
		body: req.body,
	});
	res.json({
		status: 'ok',
		data: req.body,
	});
};

export default handler;
