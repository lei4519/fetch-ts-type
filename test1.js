const fs = require("fs");

const text = fs.readFileSync('./example/index.ts', 'utf-8')

const namespace = 'TaskInfo'

const reg = new RegExp(`(?:export\\s*)*namespace\\s+${namespace}\\s*{`)

const ex = reg.exec(text)

if (ex) {
	const prefixLen = ex.index + ex[0].length
	const s = text.substring(prefixLen)
	const r = /{|}/g
	let m
	let i = 1
	let res = {}
	while ((m = r.exec(s)) !== null) {
		const char = m[0]
		if (char === '{') {
			i++
		} else {
			i--
		}
		if (i === 0) {
			res.start = ex.index
			res.end = prefixLen + m.index + 1
			res.content = text.substring(res.start, res.end)
			console.log(res)
			break
		}
	}
}


