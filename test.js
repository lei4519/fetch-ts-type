const Diff = require('diff');

const one = `
interface Data {
	name?: string
	foo: bar
	// 年两
	age: boolean
}
`
const other = `
interface Data {
	name: string
	foo?: bar
	age: boolean
	bar: foo
}
`
// const other = `
// interface Data {
// 	status: number
// 	name?: string
// 	foo: bar
// 	age: boolean
// }
// `

const diffs = Diff.diffLines(one, other)
console.log(diffs)
const txt1 = diffs.reduce((txt, { value, added, removed }, i) => {
	// 删除跟着添加，说明是修改
	if (removed) {
		const next = diffs[i + 1]
		if (next?.added) {
			value = `<<<<<<<\n${value}=======\n${next.value}>>>>>>>\n`
			next.value = ''
		}
	}
	return txt + value
}, '')

console.log(txt1);
