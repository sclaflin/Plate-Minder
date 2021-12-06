import { Readable } from 'stream';
import { spawn } from 'child_process';

export default class RTSPToMJPEG extends Readable {
	#url = null;
	#captureInterval = null;
	#ffmpeg = null;
	#buffs = [];

	constructor(options, url, captureInterval) {
		super(options);

		if(!(url instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		if(typeof captureInterval !== 'number')
			throw new TypeError('captureInterval must be an number.');
		
		this.#url = url;
		this.#captureInterval = captureInterval;
	}
	_construct(callback) {
		this.#ffmpeg = spawn('./ffmpeg/ffmpeg', [
			'-hide_banner',
			'-loglevel', 'error',
			'-ss', '1',
			'-i', this.#url.href,
			'-c:v', 'mjpeg',
			'-q:v', '4',
			'-r', `1/${this.#captureInterval}`,
			'-f', 'mpjpeg',
			'-an',
			'-'
		]);
		this.#ffmpeg.stdout.on('data', data => {
			this.#buffs.push(data);
		});
		this.#ffmpeg.stderr.on('data', data => {
			// console.log(`stderr: ${data}`);
		});
		this.#ffmpeg.on('close', code => {
			if(code !== 0)
				this.destroy(new Error(`Exited with error code: ${code}`));
			this.#ffmpeg = null;
		});

		callback();
	}
	async _read() {
		while(true) {
			const buff = this.#buffs.shift();
			if(buff === undefined) {
				//pause for a second to allow the RTSP stream to produce some data
				await new Promise(resolve => setTimeout(() => resolve(), 1000));
				continue;
			}
			if(!this.push(buff))
				break;
		}
	}
	_destroy(err, callback) {
		this.#ffmpeg.stdin.write('q');
		callback(err);
	}
	get url() {
		return this.#url;
	}
	get captureInterval() {
		return this.#captureInterval;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			null,
			new URL(config.url),
			config.captureInterval
		);
	}
}