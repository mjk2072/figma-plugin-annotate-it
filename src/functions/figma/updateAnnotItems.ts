import Differy from '@netilon/differify'
import contentBlockToNode from '@/functions/figma/contentBlockToNode'
import { generateAnnotItemNode, getAnnotWrapperNode } from '@/functions/figma/figmaHelpers'

const differy = new Differy()


export default ( msgValue: { newAnnots: object[], oldAnnots: object[] } ) => {
  const diff = differy.compare(msgValue.oldAnnots, msgValue.newAnnots)

  console.clear()

  if (diff.changes > 1) {
    // There are more than 1 change at a time. We should check if the ids has changed.
    // (Which would mean that we would have to re-initiate every item, due to the changed order of items.)
    const firstItem = diff._[0]
    if (firstItem.status === 'MODIFIED' && firstItem._.id.status === 'MODIFIED') {
      console.log('Detected a change of the id. This means the order has changed and we now have to re-initiate every item.')
      return
    }
  }

  for (const item of diff._) {
    switch (item.status) {
      case 'ADDED':     handleAddedAnnotItem(item); break
      case 'DELETED':   handleDeletedAnnotItem(item); break
      case 'MODIFIED':  handleModifiedAnnotItem(item); break
    }
  }
}


const handleAddedAnnotItem = ( item: any ) => {
  const { current: newItem } = item

  console.log('Adding:', newItem)
  
  generateAnnotItemNode(newItem)
}


const handleDeletedAnnotItem = ( item: any ) => {
  const { original: deletedItem } = item

  console.log('Deleting:', deletedItem.id)
  // @TODO implement deleting items in Figma.
}


const handleModifiedAnnotItem = ( item: any ) => {
  const annotNode = <FrameNode>getAnnotWrapperNode().findChild(node => node.name.includes(item._.id.current))

  // Loop through item entries (id, title, content, ...)
  let doneChanges = 0
  for (let entryName of Object.keys(item._)) {
    const { changes, current: newValue } = item._[entryName]
    if (!changes)
      continue

    switch (entryName) {
      case 'title':
        const titleNode = <TextNode>annotNode.findOne(node => node.name === 'Text')
        titleNode.characters = newValue.length === 0 ? 'Title' : newValue
        titleNode.opacity = newValue.length === 0 ? .25 : 1
        break
    
      case 'content':
        handleModifiedItem_content(item, entryName, annotNode)
    }

    if (entryName !== 'content')
      console.log(`Detected a change in ${entryName}. The new value is:`, newValue)
      // @TODO implement these changes in Figma.

    doneChanges++
    if (doneChanges === item.changes)
      break
  }
}


const handleModifiedItem_content = ( item: any, entryName: string, annotNode: FrameNode ) => {
  const bodyNode = <FrameNode>annotNode.findChild(node => node.name === 'Body')

  const diffObj = item._[entryName],
        contentBlockArr = diffObj._,
        contentBlocksAmount = contentBlockArr.filter(b => b.status !== 'DELETED').length

  let doneContentChanges = 0,
      expectedContentChanges = diffObj.changes,
      figmaNodeListIndex = -1

  for (let i = 0; i < contentBlockArr.length; i++) {
    figmaNodeListIndex++

    console.log('i', i, '- figmaNodeListIndex', figmaNodeListIndex)

    const contentBlock = contentBlockArr[i]
    if (!contentBlock.changes)
      continue

    switch (contentBlock.status) {
      case 'ADDED':
        const newContentBlock = _generateSafeAddedContentBlock(contentBlock.current),
              newNode = contentBlockToNode({ contentBlock: newContentBlock, contentBlocksAmount })

        console.log(`ADDED (line ${i + 1})`, newContentBlock)
        bodyNode.insertChild(figmaNodeListIndex, newNode)
        break
    
      case 'DELETED':
        console.log(`REMOVED (line ${i + 1})`, contentBlock)
        bodyNode.children[figmaNodeListIndex].remove()
        figmaNodeListIndex--
        break
        
      case 'MODIFIED':
        const modifiedContentBlock = _generateSafeModifiedContentBlock(contentBlock),
              modifiedNode = contentBlockToNode({ contentBlock: modifiedContentBlock, contentBlocksAmount })

        console.log(`MODIFIED (on line ${i + 1})`, modifiedContentBlock)
        bodyNode.children[figmaNodeListIndex].remove()
        bodyNode.insertChild(figmaNodeListIndex, modifiedNode)
        break
    }

    doneContentChanges++
    if (doneContentChanges === expectedContentChanges)
      break
  }
}


const _generateSafeAddedContentBlock = ( contentBlock: any ) => {
  return { 
    ...contentBlock, 
    content: contentBlock?.content 
      ? JSON.parse(contentBlock.content) // when content is already something
      : [{ type: 'text', text: ' ' }] // when content is undefined
  }
}


const _generateSafeModifiedContentBlock = ( contentBlock: any ) => {
  return {
    type: contentBlock._.type.current,
    content: contentBlock._.content.current
      ? JSON.parse(contentBlock._.content.current) // when content is already something
      : [{ type: 'text', text: ' ' }] // when content is undefined
  }
}