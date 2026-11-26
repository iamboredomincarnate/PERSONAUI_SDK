/** Add an affinity selector to a context menu that stores items in `items`. */
export function addAffinitySetter(contextMenu, { target, affinities, getAffinity, setAffinity }) {
	if (!contextMenu || !Array.isArray(contextMenu.items)) {
		throw new TypeError('contextMenu.items must be an array');
	}
	if (!Array.isArray(affinities) || typeof setAffinity !== 'function') {
		throw new TypeError('affinities and setAffinity are required');
	}

	const currentAffinity = typeof getAffinity === 'function'
		? getAffinity(target)
		: undefined;

	const item = {
		label: 'Set affinity',
		submenu: affinities.map((affinity) => ({
			label: typeof affinity === 'string' ? affinity : affinity.label,
			value: typeof affinity === 'string' ? affinity : affinity.value,
			checked: (typeof affinity === 'string' ? affinity : affinity.value) === currentAffinity,
			onSelect() {
				setAffinity(target, typeof affinity === 'string' ? affinity : affinity.value);
			},
		})),
	};

	contextMenu.items.push(item);
	return item;
}
