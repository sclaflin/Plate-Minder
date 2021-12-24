import Iterable from './Iterable.js';
import MJPEGReadable from './MJPEGReadable.js';

export default class MJPEGReadables extends Iterable {
	add(...items) {
		for(const item of items)
			if(!(item instanceof MJPEGReadable))
				throw new TypeError('all items must be an instance of MJPEGReadable.');
		super.add(...items);
	}
}
