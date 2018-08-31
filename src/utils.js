export function normalize(attr) {
    if (attr === null || typeof attr !== 'object' || Object.prototype.toString.call(attr) === '[object Array]') {
        return attr;
    }

    let mutable = {};
    Object.keys(attr).forEach(key => {
        _setOnPath(mutable, key.split('.'), normalize(attr[key]));
    });

    return mutable;
}

function _setOnPath(obj, path, value) {
    if (!path) {
        return obj;
    }

    var currentPath = path[0];
    if (path.length === 1) {
        var oldVal = obj[currentPath];

        if (oldVal === undefined) {
            obj[currentPath] = value;
        }

        return oldVal;
    }

    if (obj[currentPath] === undefined) {
        obj[currentPath] = {};
    }

    return _setOnPath(obj[currentPath], path.slice(1), value);
}

export function repeatableOptionCallback(val, result) {
    result.push(val);
    return result;
}

export function parseVersion(version) {
    if (!version.includes("enterprise-edition")) {
        // remove any postfix, i.e., 0.11.0-rc1 should be 0.11.0
        return version.split("-")[0];
    }

    // Kong EE versioning is X.Y(-Z)-enterprise-edition
    var vAry = version.split("-")

    if (vAry.length == 4) {
        version = vAry[0] + "." + vAry[1]
    } else {
        version = vAry[0];
    }

    // add .0 so that kong EE has a patch version, i.e, 0.29 should be 0.29.0
    if (version.split(".").length == 2) {
        version = version + ".0"
    }

    return version
}

export function subsetArray(value = [], other = []) {
    return other.every(o => value.includes(o));
}

export function sameArray(value = [], other = []) {
    if (value === null && other === null) return true;

    // Get the value type
    var type = Object.prototype.toString.call(value);

    // If the two objects are not the same type, return false
    if (type !== Object.prototype.toString.call(other)) return false;

    // If items are not an object or array, return false
    if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

    // Compare the length of the length of the two items
    var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
    var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
    if (valueLen !== otherLen) return false;

    // Compare two items
    var compare = function (item1, item2) {

	// Get the object type
	var itemType = Object.prototype.toString.call(item1);

	// If an object or array, compare recursively
	if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
	    if (!isEqual(item1, item2)) return false;
	}

	// Otherwise, do a simple comparison
	else {

	    // If the two items are not the same type, return false
	    if (itemType !== Object.prototype.toString.call(item2)) return false;

	    // Else if it's a function, convert to a string and compare
	    // Otherwise, just compare
	    if (itemType === '[object Function]') {
		if (item1.toString() !== item2.toString()) return false;
	    } else {
		if (item1 !== item2) return false;
	    }

	}
    };

    // Compare properties
    if (type === '[object Array]') {
	for (var i = 0; i < valueLen; i++) {
	    if (compare(value[i], other[i]) === false) return false;
	}
    } else {
	for (var key in value) {
	    if (value.hasOwnProperty(key)) {
		if (compare(value[key], other[key]) === false) return false;
	    }
	}
    }

    // If nothing failed, return true
    return true;

}
