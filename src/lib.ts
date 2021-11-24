// @ts-nocheck
function last(arr) {
    return arr[arr.length - 1]
}

function diff(x_str, y_str) {
    const x_max = x_str.length
    const y_max = y_str.length
    const g_max = x_max + y_max

    const kx_map = {}
    const d_kxmap = []

    let d = 0;

    while (d <= g_max) {
        let k = -d;

        d_kxmap.push({})

        while (k <= d) {
            let x;

            // 左边的 x (k - 1)
            let left_x = kx_map[k - 1] ?? -1
            let up_x = kx_map[k + 1] ?? -1

            if (k === -d) {
                x = up_x;
            } else if (k === d) {
                // 这意味着向右直走，全部删除，x 需要基于上一步前进一位
                x = left_x + 1;
            } else {
                x = left_x < up_x ? up_x : left_x + 1
            }

            // 拿到 x 就可以计算出 y 了
            let y = x - k;
            // 相同文本情况 走斜向前进
            while (y < y_max && x < x_max && eq(x_str, y_str, x, y)) {
                x = x + 1;
                y = y + 1;
            }

            // 记录
            kx_map[k] = x
            last(d_kxmap)[k] = x

            if (x >= x_max && y >= y_max) {
                return d_kxmap;
            }

            k = k + 2;
        }
        d = d + 1;
    }
    return d_kxmap
}

// 生成最优路径
function gen_snakes(d_kxmap, x_max, y_max) {
    let snakes = []

    // 从终点回溯
    let x = x_max;
    let y = y_max;

    // 终点先放进去
    snakes.push([x, y, null]);

    // 倒退每一步 d
    let d = d_kxmap.length - 1;

    while (d > 0) {
        // 计算 k
        let k = x - y;

        let kx_map = d_kxmap[d - 1]

        let up_x = kx_map[k + 1] ?? -1
        // 在上一个点向右走过来 (k - 1)
        let left_x = kx_map[k - 1] ?? -1

        // 两个都没有，说明已经到头了
        if (left_x === -1 && up_x === -1) {
            return snakes;
        }

        // 计算两者的y坐标
        let up_y = up_x - k - 1;
        let left_y = left_x - k + 1;

        // 计算当前 x 坐标和上一个 x 坐标的差值
        let up_x_gap = x - up_x;
        let left_x_gap = x - left_x;

        // 说明左边更近
        let is_left_best = left_x_gap < up_x_gap;

        // 如果两个都有值, 就需要分别比对两者哪个更优，哪个点离当前更近
        // 如果 x 一样，需要比对 y
        if (left_x_gap === up_x_gap) {
            // 计算 y 轴差值
            let up_y_gap = up_y - y;
            let left_y_gap = left_y - y;

            // 如果左边的 y 差值更小，说明也是左边更好
            is_left_best = Math.abs(left_y_gap) < Math.abs(up_y_gap)
        }

        // 上一步最优的坐标点
        let pre_x = is_left_best ? left_x : up_x;
        let pre_y = is_left_best ? left_y : up_y;

        // 拿到上一个点的坐标，压栈
        snakes.push([pre_x, pre_y, is_left_best]);
        x = pre_x;
        y = pre_y;

        d = d - 1;
    }
    return snakes
}

const Diff = {
    EQ: "EQ",
    ADD: "ADD",
    RM: "RM",
}

// 解析返回差异结果
function resolve_result(snakes, x_str, y_str) {
    let result = [];

    // x 文本的长度
    let x_max = x_str.length
    // y 文本的长度
    let y_max = y_str.length

    let push = (result, action, v) => {
        let last_r = last(result)
        let start = 0
        let end = start
        if (last_r) {
            end = last_r[3] + 1
            if (last_r[0] === action) {
                last_r[1] = last_r[1] + v;
                last_r[3] = end
                return;
            } else {
                // 删除后添加，说明是修改，位置不变
                if (last_r[0] === 'RM' && action === 'ADD') {
                    start = end = last_r[3]
                } else {
                    start = last_r[3] + 1
                }
            }
        }
        result.push([action, v, start, end]);
    };

    // 相同字符处理
    let advance = (result, x, y) => {
        while (x < x_max && y < y_max && eq(x_str, y_str, x, y)) {
            push(result, Diff.EQ, x_str[x]);
            x = x + 1;
            y = y + 1;
        }
    };

    // 处理头部相同的情况
    advance(result, 0, 0);

    while (snakes.length) {
        let [x, y, is_left_best] = snakes.pop();

        //is_left_best 为空代表是最后一个点了
        if (is_left_best === null) {
            break;
        }

        if (is_left_best) {
            // 意味着向右走，删除
            push(result, Diff.RM, x_str[x]);
            x = x + 1;
            advance(result, x, y);
        } else {
            // 新增
            push(result, Diff.ADD, y_str[y]);
            y = y + 1;
            advance(result, x, y);
        }
    }

    return result
}

// 判断是否相等
function eq(x_str, y_str, x, y) {
    x = x_str[x] ?? ''
    y = y_str[y] ?? ''
    return x === y
}

export function myers(x_str, y_str) {
    const map = diff(x_str, y_str)
    const snakes = gen_snakes(map, x_str.length, y_str.length)
    return resolve_result(snakes, x_str, y_str)
}

