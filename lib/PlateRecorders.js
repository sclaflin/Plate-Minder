import Iterable from './Iterable.js';
import PlateRecorder from './PlateRecorder.js';

export default class PlateRecorders extends Iterable {
	add(...items) {
		for(const item of items)
			if(!(item instanceof PlateRecorder))
				throw new TypeError('all items must be an instance of PlateRecorder.');
		super.add(...items);
	}
}
