import type { CommandModule } from "yargs"
/**
 * 语法解读：
 * type WithDoubleDash<T>	泛型类型，T 可以是任意类型
 * T &	交叉类型：结果要同时满足 T 和后面的类型
 * { "--"?: string[] }	对象类型，带一个可选属性
 * "--"	属性名是字面量 "--"（双横线）
 * ?	该属性可选，可以不存在
 * string[]	字符串数组
 */
type WithDoubleDash<T> = T & { "--"?: string[] }

export function cmd<T, U>(input: CommandModule<T, WithDoubleDash<U>>) {
  return input
}
