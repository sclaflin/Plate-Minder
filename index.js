import YAML from 'yaml';
import fs from 'fs/promises';
import PlateMinder from './lib/PlateMinder.js';


(async () => {
	const config = YAML.parse(
		(await fs.readFile('config.yaml')).toString()
	);

	PlateMinder.fromObject({
		mjpegToAlpr: {
			mjpegReadable: config.mjpeg,
			mjpegToJpeg: {},
			alpr: config.alpr
		},
		recorders: config.recorder
	});
	
})();

