export const RemoveDuplicates = (array, key) => {
    return array.reduce((arr, item) => {
        const removed = arr.filter((i) => i[key] !== item[key]);
        return [...removed, item];
    }, []);
};
