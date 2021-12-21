import { Writable } from 'stream';

const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);

export default class MJPEGToJPEG extends Writable {
	#chunks = [];
	_write(chunk, encoding, done) {
		while(chunk.length > 0) {
			const indexStart = chunk.indexOf(JPEG_START);
			const indexEnd = chunk.indexOf(JPEG_END);
			// Are we in the middle of capturing a jpeg?
			if(this.#chunks.length > 0) {
				// Is the end of the jpeg present?
				if(indexEnd > -1) {
					// Push data up to the indexEnd
					this.#chunks.push(chunk.slice(0, indexEnd + 2));
					const jpeg = Buffer.concat(this.#chunks);
					this.#chunks.length = 0;
					// Overwrite the chunk with data after indexEnd
					chunk = chunk.slice(indexEnd + 2);
					this.emit('jpeg', jpeg);
				}
				else {
					this.#chunks.push(chunk);
					// Overwrite the chunk with an empty slice
					chunk = chunk.slice(0, 0);
				}
					
			}
			// Not capturing anything yet...
			else {
				// Is the start of a jpeg present?
				if(indexStart > -1) {
					// Is the end of the jpeg present?
					if(indexEnd > -1) {
						this.#chunks.push(chunk.slice(indexStart, indexEnd + 2));
						const jpeg = Buffer.concat(this.#chunks);
						this.#chunks.length = 0;
						chunk = chunk.slice(indexEnd + 2);
						this.emit('jpeg', jpeg);
					}
					else {
						// Consume the whole chunk from the indexStart
						this.#chunks.push(chunk.slice(indexStart));
						// Overwrite the chunk with an empty slice
						chunk = chunk.slice(0, 0);
					}
				}
				// No start of jpeg found
				else {
					// Overwrite the chunk with an empty slice
					chunk = chunk.slice(0, 0);
				}
			}
		}
		done();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this();
	}
}
