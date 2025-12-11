getAvailableLibraryVariableCollectionsAsync

Returns a descriptor of all VariableCollections that exist in the enabled libraries of the current file. Rejects if the request fails.

This requires that users enable libraries that contain variables via the UI. Currently it is not possible to enable libraries via the Plugin API.
Signature
getAvailableLibraryVariableCollectionsAsync(): Promise<LibraryVariableCollection[]>

Remarks

This is intended to be used in conjunction with getVariablesInLibraryCollectionAsync

LibraryVariableCollection
Library Variable Collection properties
name: string

The name of the variable collection.
key: string

The key of the variable collection.
libraryName: string

The name of the library that contains this variable collection.

LibraryVariable
Library Variable properties
name: string

The name of the variable.
key: string

The key of the variable.
resolvedType: VariableResolvedDataType

The resolved type of this variable.

extendLibraryCollectionByKeyAsync

Creates a new extended variable collection from a library or local variable collection with the given name.
Signature
extendLibraryCollectionByKeyAsync(collectionKey: string, name: string): Promise<ExtendedVariableCollection>
Parameters
collectionKey

The key of the library or local variable collection to extend.
name

The name of the newly created variable collection.

This API is limited to the Enterprise plan. If limited by the current pricing tier, this method will throw an error with the message in extend: Cannot create extended collections outside of enterprise plan.

getVariablesInLibraryCollectionAsync

Returns a descriptor of all Variables that exist in a given LibraryVariableCollection. Rejects if the given variable collection does not exist, or if the current user does not have access to that variable collection's library, or if the request fails.
Signature
getVariablesInLibraryCollectionAsync(libraryCollectionKey: string): Promise<LibraryVariable[]>
Parameters
libraryCollectionKey

the key of the library variable collection that contains the returned library variables.
Example usage
Example usage of getVariablesInLibraryCollectionAsync

// Query all published collections from libraries enabled for this file
const libraryCollections =
    await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
// Select a library variable collection to import into this file
const variablesInFirstLibrary =
    await figma.teamLibrary.getVariablesInLibraryCollectionAsync(libraryCollections[0].key)
// Import the first number variable we find in that collection
const variableToImport =
    variablesInFirstLibrary.find((libVar) => libVar.resolvedType === 'FLOAT')
const importedVariable =
    await figma.variables.importVariableByKeyAsync(variableToImport.key)

Previous
getAvailableLibraryVariableCollectionsAsync
Next
annotations