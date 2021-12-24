import Iterable from './Iterable.js';
import ImageFilter from './ImageFilter.js';

export default class ImageFilters extends Iterable {
	add(...items) {
		for(const item of items)
			if(!(item instanceof ImageFilter))
				throw new TypeError('all items must be an instance of ImageFilter.');
		super.add(...items);
	}
}
