/** One shared, reusable text comparer ("Film 2" before "Film 10"; ignores case and accents).
 *  Creating a comparer per comparison (localeCompare with options) is ~20× slower. */
export const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const compareTitles = (a: string, b: string) => titleCollator.compare(a, b);
