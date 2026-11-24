import { INTERNAL, Point, Range, SIZE_OF_INT, SIZE_OF_NODE, C } from "./constants";
import { Node } from "./node";
import { Tree } from "./tree";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Query, QueryCapture, type QueryMatch } from "./query";
import { TreeCursor } from "./tree_cursor";
import { TRANSFER_BUFFER } from "./parser";
import { LanguageMetadata } from "./language";
import { Edit } from "./edit";

/**
 * @internal
 *
 * Unmarshals a {@link QueryMatch} to the transfer buffer.
 */
export function unmarshalCaptures(
  query: Query,
  tree: Tree,
  address: number,
  patternIndex: number,
  result: QueryCapture[]
) {
  const heap32 = C.HEAP32;
  const captureNames = query.captureNames;
  let word = address >>> 2;
  for (let i = 0, n = result.length; i < n; i++) {
    const captureIndex = heap32[word];
    const node = new Node(INTERNAL, {
      id: heap32[word + 1],
      tree,
      startIndex: heap32[word + 2],
      startPosition: { row: heap32[word + 3], column: heap32[word + 4] },
      other: heap32[word + 5],
    });
    word += 6;
    result[i] = { patternIndex, name: captureNames[captureIndex], node };
  }
  return word * SIZE_OF_INT;
}

/**
 * @internal
 *
 * Marshals a {@link Node} to the transfer buffer.
 */
export function marshalNode(node: Node, index = 0) {
  const heap32 = C.HEAP32;
  const word = (TRANSFER_BUFFER + index * SIZE_OF_NODE) >>> 2;
  heap32[word] = node.id;
  heap32[word + 1] = node.startIndex;
  heap32[word + 2] = node.startPosition.row;
  heap32[word + 3] = node.startPosition.column;
  heap32[word + 4] = node[0];
}

/**
 * @internal
 *
 * Unmarshals a {@link Node} from the transfer buffer.
 */
export function unmarshalNode(tree: Tree, address = TRANSFER_BUFFER): Node | null {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  const id = heap32[word];
  if (id === 0) return null;

  return new Node(INTERNAL, {
    id,
    tree,
    startIndex: heap32[word + 1],
    startPosition: { row: heap32[word + 2], column: heap32[word + 3] },
    other: heap32[word + 4],
  });
}

/**
 * @internal
 *
 * Marshals a {@link TreeCursor} to the transfer buffer.
 */
export function marshalTreeCursor({ handles }: Pick<TreeCursor, 'handles'>, address = TRANSFER_BUFFER) {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  heap32[word] = handles[0];
  heap32[word + 1] = handles[1];
  heap32[word + 2] = handles[2];
  heap32[word + 3] = handles[3];
}

/**
 * @internal
 *
 * Unmarshals a {@link TreeCursor} from the transfer buffer.
 */
export function unmarshalTreeCursor({ handles }: TreeCursor) {
  const heap32 = C.HEAP32;
  const word = TRANSFER_BUFFER >>> 2;
  handles[0] = heap32[word];
  handles[1] = heap32[word + 1];
  handles[2] = heap32[word + 2];
  handles[3] = heap32[word + 3];
}

/**
 * @internal
 *
 * Marshals a {@link Point} to the transfer buffer.
 */
export function marshalPoint(address: number, point: Point): void {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  heap32[word] = point.row;
  heap32[word + 1] = point.column;
}

/**
 * @internal
 *
 * Unmarshals a {@link Point} from the transfer buffer.
 */
export function unmarshalPoint(address: number): Point {
  const heapU32 = C.HEAPU32;
  const word = address >>> 2;
  return {
    row: heapU32[word],
    column: heapU32[word + 1],
  };
}

/**
 * @internal
 *
 * Marshals a {@link Range} to the transfer buffer.
 */
export function marshalRange(address: number, range: Range): void {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  heap32[word] = range.startPosition.row;
  heap32[word + 1] = range.startPosition.column;
  heap32[word + 2] = range.endPosition.row;
  heap32[word + 3] = range.endPosition.column;
  heap32[word + 4] = range.startIndex;
  heap32[word + 5] = range.endIndex;
}

/**
 * @internal
 *
 * Unmarshals a {@link Range} from the transfer buffer.
 */
export function unmarshalRange(address: number): Range {
  const heapU32 = C.HEAPU32;
  const word = address >>> 2;
  return {
    startPosition: { row: heapU32[word], column: heapU32[word + 1] },
    endPosition: { row: heapU32[word + 2], column: heapU32[word + 3] },
    startIndex: heapU32[word + 4],
    endIndex: heapU32[word + 5],
  };
}

/**
 * @internal
 *
 * Marshals an {@link Edit} to the transfer buffer.
 */
export function marshalEdit(edit: Edit, address = TRANSFER_BUFFER) {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  heap32[word] = edit.startPosition.row;
  heap32[word + 1] = edit.startPosition.column;
  heap32[word + 2] = edit.oldEndPosition.row;
  heap32[word + 3] = edit.oldEndPosition.column;
  heap32[word + 4] = edit.newEndPosition.row;
  heap32[word + 5] = edit.newEndPosition.column;
  heap32[word + 6] = edit.startIndex;
  heap32[word + 7] = edit.oldEndIndex;
  heap32[word + 8] = edit.newEndIndex;
}

/**
 * @internal
 *
 * Unmarshals a {@link LanguageMetadata} from the transfer buffer.
 */
export function unmarshalLanguageMetadata(address: number): LanguageMetadata {
  const heap32 = C.HEAP32;
  const word = address >>> 2;
  return {
    major_version: heap32[word],
    minor_version: heap32[word + 1],
    patch_version: heap32[word + 2],
  };
}
