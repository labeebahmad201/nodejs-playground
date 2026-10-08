const tag = "cjs-lib";

function greet(who) {
  return `hello ${who} from CJS`;
}

module.exports = { tag, greet };
