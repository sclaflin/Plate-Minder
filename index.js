import YAML from 'yaml';
import fs from 'fs/promises';
import PlateMinder from './lib/PlateMinder.js';


(async () => {
	const config = YAML.parse(
		(await fs.readFile('config.yaml')).toString()
	);

	PlateMinder.fromObject({
		rtspToAlpr: {
			rtsp: {
				url: config.rtsp.url,
				captureInterval: config.rtsp.captureInterval
			},
			mjpegToJpeg: {},
			alpr: {
				url: config.alpr.url
			}
		},
		recorders: config.recorder
	});
	
})();

