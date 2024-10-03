/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

import { SchemaUnionsKey, type ScalarsEnumsHash } from 'gqty';

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
    ID: { input: string; output: string };
    String: { input: string; output: string };
    Boolean: { input: boolean; output: boolean };
    Int: { input: number; output: number };
    Float: { input: number; output: number };
    ByteArray: { input: any; output: any };
    Date: { input: any; output: any };
    /** The DateTime scalar represents an ISO-8601 compliant date time type. */
    DateTime: { input: string; output: string };
    JSON: { input: any; output: any };
    URL: { input: any; output: any };
    UUID: { input: any; output: any };
    field_String_pattern_id: { input: any; output: any };
    groupBy_List_String_pattern_id: { input: any; output: any };
}

export interface AIO_GrantInput {
    awardee: OrganizationInput;
    fundingAgency: OrganizationInput;
    grantId: Scalars['String']['input'];
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    reportSymbol?: InputMaybe<Scalars['String']['input']>;
    title: Scalars['String']['input'];
}

export interface AIO_ProtocolInput {
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    title: Scalars['String']['input'];
    urlResource: UrlResourceInput;
}

export enum AIO_SpecimenFacetedSearchPropertyType {
    ANNOTATION = 'ANNOTATION',
    IMAGE = 'IMAGE',
    MEASUREMENT = 'MEASUREMENT',
}

export interface AIO_SpecimenInput {
    annotations?: InputMaybe<Array<AnnotationInput>>;
    cRID: CRIDInput;
    files?: InputMaybe<Array<SpecimenFileInput>>;
    images?: InputMaybe<Array<ImageInput>>;
    measurements?: InputMaybe<Array<MeasurementInput>>;
    projectReferenceIds: Array<Scalars['String']['input']>;
    referenceId: Scalars['String']['input'];
    relatedSpecimens?: InputMaybe<Array<RelatedSpecimenInput>>;
    specimenType: SpecimenTypeInput;
}

export interface AggregationOperation {
    field?: InputMaybe<Scalars['String']['input']>;
    operator?: InputMaybe<AggregationOperator>;
}

export enum AggregationOperator {
    SUM = 'SUM',
}

/** A feature associated with an annotation. */
export interface AnnotationFeatureInput {
    /** Whether this AnnotationFeature is a default AnnotationFeature. */
    default: Scalars['Boolean']['input'];
    /** The ID of the associated FeatureType. */
    featureTypeId: Scalars['UUID']['input'];
    /** The priority order for sorting the AnnotationFeature. */
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
}

/** Represents a base model for Annotation records. */
export interface AnnotationFilterInput {
    and?: InputMaybe<Array<AnnotationFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The description for the annotation. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<AnnotationFilterInput>>;
    /** The priority order for sorting the annotation. */
    priorityOrder?: InputMaybe<ComparableNullableOfInt32OperationFilterInput>;
    /** The reference identifier of the annotation. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The short title of the annotation. */
    shortTitle?: InputMaybe<StringOperationFilterInput>;
    /** The title of the annotation. */
    title?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/**
 * This allows us to distinguish whether the Annotation we are providing information for
 * is an SvgAnnotation.
 */
export interface AnnotationInput {
    featureType: FeatureTypeInput;
    modality?: InputMaybe<Array<ModalityInput>>;
    referenceId: Scalars['String']['input'];
    /** The Annotation we are providing information for is an SvgAnnotation. */
    svgAnnotation?: InputMaybe<SvgAnnotationInput>;
    taxons: Array<TaxonInput>;
}

/** Represents the AnnotationType. */
export enum AnnotationType {
    /** Indicates that the Annotation is for a full Visualization. */
    FULL = 'FULL',
    /** Indicates that the Annotation is for a grid Visualization. */
    GRID = 'GRID',
}

export interface BffFilter {
    field?: InputMaybe<Scalars['String']['input']>;
    operator?: InputMaybe<BffFilterOperator>;
    value?: InputMaybe<Scalars['String']['input']>;
}

export enum BffFilterOperator {
    CONTAINS = 'CONTAINS',
    EQ = 'EQ',
}

export interface BffSort {
    field?: InputMaybe<Scalars['String']['input']>;
    order?: InputMaybe<BffSortOrder>;
}

export enum BffSortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

/** A representation of a dataset used in the Brain Knowledge Platform Explorer. */
export interface BkpDatasetFilterInput {
    and?: InputMaybe<Array<BkpDatasetFilterInput>>;
    /** The cell properties that belongs to the dataset. */
    cellProperties?: InputMaybe<ListFilterInputTypeOfCellPropertyFilterInput>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The reference id for the dataset's BKP data collection. */
    dataCollectionReferenceId?: InputMaybe<StringOperationFilterInput>;
    /** The description of the dataset. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** A list of metadata associated to the dataset. */
    metadata?: InputMaybe<ListFilterInputTypeOfMetadataFilterInput>;
    or?: InputMaybe<Array<BkpDatasetFilterInput>>;
    /** The priority order of the dataset. */
    priorityOrder?: InputMaybe<ComparableNullableOfInt32OperationFilterInput>;
    /** The reference id for the dataset's BKP project. */
    projectReferenceId?: InputMaybe<StringOperationFilterInput>;
    /** The reference id for the dataset. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The short title of the dataset. */
    shortTitle?: InputMaybe<StringOperationFilterInput>;
    /** The title of the dataset. */
    title?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    /** The version of the dataset. */
    version?: InputMaybe<StringOperationFilterInput>;
    /** A list of Visualizations supported by the dataset. */
    visualizations?: InputMaybe<ListFilterInputTypeOfVisualizationFilterInput>;
}

/** A representation of a dataset used in the Brain Knowledge Platform Explorer. */
export interface BkpDatasetSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The reference id for the dataset's BKP data collection. */
    dataCollectionReferenceId?: InputMaybe<SortOrder>;
    /** The description of the dataset. */
    description?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The priority order of the dataset. */
    priorityOrder?: InputMaybe<SortOrder>;
    /** The reference id for the dataset's BKP project. */
    projectReferenceId?: InputMaybe<SortOrder>;
    /** The reference id for the dataset. */
    referenceId?: InputMaybe<SortOrder>;
    /** The short title of the dataset. */
    shortTitle?: InputMaybe<SortOrder>;
    /** Defines the state that the dataset is in. */
    state?: InputMaybe<SortOrder>;
    /** The title of the dataset. */
    title?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
    /** The version of the dataset. */
    version?: InputMaybe<SortOrder>;
}

export interface BooleanOperationFilterInput {
    eq?: InputMaybe<Scalars['Boolean']['input']>;
    neq?: InputMaybe<Scalars['Boolean']['input']>;
}

export interface CRIDInput {
    registry: CRIDRegistryInput;
    symbol: Scalars['String']['input'];
}

export interface CRIDRegistryInput {
    description: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
}

export interface CVImagePropertyInput {
    cellType: Scalars['String']['input'];
    comparisonType: Scalars['String']['input'];
    gene: Scalars['String']['input'];
    metaData: Scalars['String']['input'];
    projectReferenceId: Scalars['String']['input'];
}

export enum CacheControlScope {
    PRIVATE = 'PRIVATE',
    PUBLIC = 'PUBLIC',
}

/** This defines the cell filter input */
export interface CellFilterInput {
    /** The field property for CellFilterInput. */
    field?: InputMaybe<Scalars['String']['input']>;
    /** The filter operator property for CellFilterInput. */
    operator?: InputMaybe<FilterOperator>;
    /** The type property for CellFilterInput. */
    type: CellFilterType;
    /** The value property for CellFilterInput. */
    value?: InputMaybe<Scalars['String']['input']>;
}

/** Represents the CellFilterType. */
export enum CellFilterType {
    /** Gene type for the CellFilterType */
    GENE = 'GENE',
    /** Metadata type for the CellFilterType */
    METADATA = 'METADATA',
    /** Point type for the CellFilterType */
    POINT = 'POINT',
}

/** A representation of cell by gene. */
export interface CellGeneFilterInput {
    and?: InputMaybe<Array<CellGeneFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The data collection identifier for the cell by gene. */
    dataCollectionId?: InputMaybe<StringOperationFilterInput>;
    /** The genome of the gene. */
    genome?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The index of the cell by gene. */
    index?: InputMaybe<ComparableInt32OperationFilterInput>;
    /** The maximum value for the cell by gene. */
    max?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The minimum value for the cell by gene. */
    min?: InputMaybe<ComparableSingleOperationFilterInput>;
    or?: InputMaybe<Array<CellGeneFilterInput>>;
    /** The gene identifier from external sources. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The symbol of the gene. */
    symbol?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    /** The data collection version the gene is a part of. */
    version?: InputMaybe<StringOperationFilterInput>;
}

/** A representation of cell by gene. */
export interface CellGeneSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The data collection identifier for the cell by gene. */
    dataCollectionId?: InputMaybe<SortOrder>;
    /** The genome of the gene. */
    genome?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The index of the cell by gene. */
    index?: InputMaybe<SortOrder>;
    /** The maximum value for the cell by gene. */
    max?: InputMaybe<SortOrder>;
    /** The minimum value for the cell by gene. */
    min?: InputMaybe<SortOrder>;
    /** The gene identifier from external sources. */
    referenceId?: InputMaybe<SortOrder>;
    /** The symbol of the gene. */
    symbol?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
    /** The data collection version the gene is a part of. */
    version?: InputMaybe<SortOrder>;
}

/** Cell property holds values that will be used to populate the FeatureTypeValueIndex. */
export interface CellPropertyFilterInput {
    and?: InputMaybe<Array<CellPropertyFilterInput>>;
    /** The color of the cell property. */
    color?: InputMaybe<StringOperationFilterInput>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The dataset that the cell property belongs to. */
    dataset?: InputMaybe<DatasetFilterInput>;
    /** The property's FeatureType. */
    featureType?: InputMaybe<FeatureTypeFilterInput>;
    /** The FeatureTypeValueIndex associated with the cell property. */
    featureTypeValueIndex?: InputMaybe<FeatureTypeValueIndexFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<CellPropertyFilterInput>>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/** Cell property holds values that will be used to populate the FeatureTypeValueIndex. */
export interface CellPropertySortInput {
    /** The color of the cell property. */
    color?: InputMaybe<SortOrder>;
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The data collection identifier of the cell property. */
    dataCollectionId?: InputMaybe<SortOrder>;
    /** The dataset that the cell property belongs to. */
    dataset?: InputMaybe<DatasetSortInput>;
    /** The dataset that the cell property belongs to. */
    datasetId?: InputMaybe<SortOrder>;
    /** The property's FeatureType. */
    featureType?: InputMaybe<FeatureTypeSortInput>;
    /** The ID of the FeatureType. */
    featureTypeId?: InputMaybe<SortOrder>;
    /** The FeatureTypeValueIndex associated with the cell property. */
    featureTypeValueIndex?: InputMaybe<FeatureTypeValueIndexSortInput>;
    /** The ID of the associated FeatureTypeValueIndex. */
    featureTypeValueIndexId?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The index of the cell property. */
    index?: InputMaybe<SortOrder>;
    /** The parent reference identifier of the cell property. */
    parentReferenceId?: InputMaybe<SortOrder>;
    /** The reference identifier of the cell property. */
    referenceId?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
    /** The value of the cell property. */
    value?: InputMaybe<SortOrder>;
}

/** A gradient for coloring properties. */
export interface ColorGradientFilterInput {
    and?: InputMaybe<Array<ColorGradientFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The colors in the gradient. Elements should be sorted where the first element corresponds to the color of the minimum value and the last corresponds to the maximum value. */
    gradient?: InputMaybe<ListExtendedStringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The color for null values. */
    nullColor?: InputMaybe<StringOperationFilterInput>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<ColorGradientFilterInput>>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/** A gradient for coloring properties. */
export interface ColorGradientSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<SortOrder>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<SortOrder>;
    /** The color for null values. */
    nullColor?: InputMaybe<SortOrder>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
}

/** A color map for coloring properties. */
export interface ColorMapFilterInput {
    and?: InputMaybe<Array<ColorMapFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** Whether to invert the color map direction. */
    invertMap?: InputMaybe<BooleanOperationFilterInput>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The name of the color map, taken from available values here - https://observablehq.com/@d3/color-schemes. */
    name?: InputMaybe<StringOperationFilterInput>;
    /** The color for null values. */
    nullColor?: InputMaybe<StringOperationFilterInput>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<ColorMapFilterInput>>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/** A color map for coloring properties. */
export interface ColorMapSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** Whether to invert the color map direction. */
    invertMap?: InputMaybe<SortOrder>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<SortOrder>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<SortOrder>;
    /** The name of the color map, taken from available values here - https://observablehq.com/@d3/color-schemes. */
    name?: InputMaybe<SortOrder>;
    /** The color for null values. */
    nullColor?: InputMaybe<SortOrder>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
}

/** Represents the ColorType. */
export enum ColorType {
    GENE = 'GENE',
    METADATA = 'METADATA',
}

export interface ComparableDateTimeOperationFilterInput {
    eq?: InputMaybe<Scalars['DateTime']['input']>;
    gt?: InputMaybe<Scalars['DateTime']['input']>;
    gte?: InputMaybe<Scalars['DateTime']['input']>;
    in?: InputMaybe<Array<Scalars['DateTime']['input']>>;
    lt?: InputMaybe<Scalars['DateTime']['input']>;
    lte?: InputMaybe<Scalars['DateTime']['input']>;
    neq?: InputMaybe<Scalars['DateTime']['input']>;
    ngt?: InputMaybe<Scalars['DateTime']['input']>;
    ngte?: InputMaybe<Scalars['DateTime']['input']>;
    nin?: InputMaybe<Array<Scalars['DateTime']['input']>>;
    nlt?: InputMaybe<Scalars['DateTime']['input']>;
    nlte?: InputMaybe<Scalars['DateTime']['input']>;
}

export interface ComparableGuidOperationFilterInput {
    eq?: InputMaybe<Scalars['UUID']['input']>;
    gt?: InputMaybe<Scalars['UUID']['input']>;
    gte?: InputMaybe<Scalars['UUID']['input']>;
    in?: InputMaybe<Array<Scalars['UUID']['input']>>;
    lt?: InputMaybe<Scalars['UUID']['input']>;
    lte?: InputMaybe<Scalars['UUID']['input']>;
    neq?: InputMaybe<Scalars['UUID']['input']>;
    ngt?: InputMaybe<Scalars['UUID']['input']>;
    ngte?: InputMaybe<Scalars['UUID']['input']>;
    nin?: InputMaybe<Array<Scalars['UUID']['input']>>;
    nlt?: InputMaybe<Scalars['UUID']['input']>;
    nlte?: InputMaybe<Scalars['UUID']['input']>;
}

export interface ComparableInt32OperationFilterInput {
    eq?: InputMaybe<Scalars['Int']['input']>;
    gt?: InputMaybe<Scalars['Int']['input']>;
    gte?: InputMaybe<Scalars['Int']['input']>;
    in?: InputMaybe<Array<Scalars['Int']['input']>>;
    lt?: InputMaybe<Scalars['Int']['input']>;
    lte?: InputMaybe<Scalars['Int']['input']>;
    neq?: InputMaybe<Scalars['Int']['input']>;
    ngt?: InputMaybe<Scalars['Int']['input']>;
    ngte?: InputMaybe<Scalars['Int']['input']>;
    nin?: InputMaybe<Array<Scalars['Int']['input']>>;
    nlt?: InputMaybe<Scalars['Int']['input']>;
    nlte?: InputMaybe<Scalars['Int']['input']>;
}

export interface ComparableNullableOfDateTimeOperationFilterInput {
    eq?: InputMaybe<Scalars['DateTime']['input']>;
    gt?: InputMaybe<Scalars['DateTime']['input']>;
    gte?: InputMaybe<Scalars['DateTime']['input']>;
    in?: InputMaybe<Array<InputMaybe<Scalars['DateTime']['input']>>>;
    lt?: InputMaybe<Scalars['DateTime']['input']>;
    lte?: InputMaybe<Scalars['DateTime']['input']>;
    neq?: InputMaybe<Scalars['DateTime']['input']>;
    ngt?: InputMaybe<Scalars['DateTime']['input']>;
    ngte?: InputMaybe<Scalars['DateTime']['input']>;
    nin?: InputMaybe<Array<InputMaybe<Scalars['DateTime']['input']>>>;
    nlt?: InputMaybe<Scalars['DateTime']['input']>;
    nlte?: InputMaybe<Scalars['DateTime']['input']>;
}

export interface ComparableNullableOfInt32OperationFilterInput {
    eq?: InputMaybe<Scalars['Int']['input']>;
    gt?: InputMaybe<Scalars['Int']['input']>;
    gte?: InputMaybe<Scalars['Int']['input']>;
    in?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
    lt?: InputMaybe<Scalars['Int']['input']>;
    lte?: InputMaybe<Scalars['Int']['input']>;
    neq?: InputMaybe<Scalars['Int']['input']>;
    ngt?: InputMaybe<Scalars['Int']['input']>;
    ngte?: InputMaybe<Scalars['Int']['input']>;
    nin?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
    nlt?: InputMaybe<Scalars['Int']['input']>;
    nlte?: InputMaybe<Scalars['Int']['input']>;
}

export interface ComparableSingleOperationFilterInput {
    eq?: InputMaybe<Scalars['Float']['input']>;
    gt?: InputMaybe<Scalars['Float']['input']>;
    gte?: InputMaybe<Scalars['Float']['input']>;
    in?: InputMaybe<Array<Scalars['Float']['input']>>;
    lt?: InputMaybe<Scalars['Float']['input']>;
    lte?: InputMaybe<Scalars['Float']['input']>;
    neq?: InputMaybe<Scalars['Float']['input']>;
    ngt?: InputMaybe<Scalars['Float']['input']>;
    ngte?: InputMaybe<Scalars['Float']['input']>;
    nin?: InputMaybe<Array<Scalars['Float']['input']>>;
    nlt?: InputMaybe<Scalars['Float']['input']>;
    nlte?: InputMaybe<Scalars['Float']['input']>;
}

export interface ContactInput {
    email: Scalars['String']['input'];
    person: PersonInput;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface DataCollectionInput {
    accessControl?: InputMaybe<Scalars['String']['input']>;
    completionState?: InputMaybe<Scalars['String']['input']>;
    description: Scalars['String']['input'];
    lastUpdatedAtDate?: InputMaybe<Scalars['Date']['input']>;
    modality?: InputMaybe<Array<InputMaybe<ModalityInput>>>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    publication?: InputMaybe<Array<InputMaybe<PublicationInput>>>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    species?: InputMaybe<Array<InputMaybe<SpeciesInput>>>;
    specimenCount?: InputMaybe<Array<InputMaybe<SpecimenCountInput>>>;
    specimenType?: InputMaybe<Array<InputMaybe<SpecimenTypeInput>>>;
    technique?: InputMaybe<Array<InputMaybe<TechniqueInput>>>;
    title: Scalars['String']['input'];
    webResources?: InputMaybe<Array<InputMaybe<UrlResourceInput>>>;
}

export interface DataCollectionProjectInput {
    citation?: InputMaybe<Scalars['String']['input']>;
    contact?: InputMaybe<Array<InputMaybe<ContactInput>>>;
    dataCollection?: InputMaybe<Array<InputMaybe<DataCollectionInput>>>;
    dataContributor?: InputMaybe<Array<InputMaybe<DataContributorInput>>>;
    dataCreator?: InputMaybe<Array<InputMaybe<DataCreatorInput>>>;
    dataPublicationYear?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
    description: Scalars['String']['input'];
    doiSymbol?: InputMaybe<Scalars['String']['input']>;
    grant?: InputMaybe<Array<InputMaybe<AIO_GrantInput>>>;
    highlightedWebResources?: InputMaybe<Array<InputMaybe<UrlResourceInput>>>;
    informationWebResource?: InputMaybe<UrlResourceInput>;
    license?: InputMaybe<Array<InputMaybe<LicenseInput>>>;
    modality?: InputMaybe<Array<InputMaybe<ModalityInput>>>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    protocol?: InputMaybe<Array<InputMaybe<AIO_ProtocolInput>>>;
    publication?: InputMaybe<Array<InputMaybe<PublicationInput>>>;
    publisher?: InputMaybe<PublisherInput>;
    readMeFile?: InputMaybe<Scalars['String']['input']>;
    referenceId: Scalars['String']['input'];
    relatedProjects?: InputMaybe<Array<InputMaybe<RelatedDataCollectionProjectInput>>>;
    shortTitle: Scalars['String']['input'];
    species?: InputMaybe<Array<InputMaybe<SpeciesInput>>>;
    specimenType?: InputMaybe<Array<InputMaybe<SpecimenTypeInput>>>;
    subProgram?: InputMaybe<Array<InputMaybe<SubProgramInput>>>;
    taxonomies?: InputMaybe<Array<TaxonomyInput>>;
    technique?: InputMaybe<Array<InputMaybe<TechniqueInput>>>;
    title: Scalars['String']['input'];
}

export interface DataContributorInput {
    agentType: Scalars['String']['input'];
    organization?: InputMaybe<OrganizationInput>;
    person?: InputMaybe<PersonInput>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
}

export interface DataCreatorInput {
    agentType: Scalars['String']['input'];
    organization?: InputMaybe<OrganizationInput>;
    person?: InputMaybe<PersonInput>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
}

/** Represents a DataType entity. */
export interface DataTypeFilterInput {
    and?: InputMaybe<Array<DataTypeFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** A JSON schema used to validate the data field of a metadata object that uses this DataType. */
    dataSchema?: InputMaybe<JsonOperationFilterInput>;
    /** Text describing any relevant details of the DataType. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    name?: InputMaybe<StringOperationFilterInput>;
    or?: InputMaybe<Array<DataTypeFilterInput>>;
    /** Any projects ExternalReferences associated to the DataType. */
    projects?: InputMaybe<ListFilterInputTypeOfExternalReferenceFilterInput>;
    /** The TypeState of the DataType. */
    state?: InputMaybe<TypeStateOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    version?: InputMaybe<ComparableSingleOperationFilterInput>;
}

/** This defines the dataset filter input */
export interface DatasetFilter {
    /** The dataCollectionReferenceId property for DatasetFilter. */
    dataCollectionReferenceId: Scalars['String']['input'];
    /** The datasetReferenceId property for DatasetFilter. */
    datasetReferenceId: Scalars['String']['input'];
    /** The version property for DatasetFilter. */
    version: Scalars['String']['input'];
}

/** Represents a base model for Dataset records. */
export interface DatasetFilterInput {
    and?: InputMaybe<Array<DatasetFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The description of the dataset. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<DatasetFilterInput>>;
    /** The priority order of the dataset. */
    priorityOrder?: InputMaybe<ComparableInt32OperationFilterInput>;
    /** The reference id for the dataset. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The short title of the dataset. */
    shortTitle?: InputMaybe<StringOperationFilterInput>;
    /** The title of the dataset. */
    title?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    /** The version of the dataset. */
    version?: InputMaybe<StringOperationFilterInput>;
}

/** Represents a base model for Dataset records. */
export interface DatasetSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The description of the dataset. */
    description?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The priority order of the dataset. */
    priorityOrder?: InputMaybe<SortOrder>;
    /** The reference id for the dataset. */
    referenceId?: InputMaybe<SortOrder>;
    /** The short title of the dataset. */
    shortTitle?: InputMaybe<SortOrder>;
    /** The title of the dataset. */
    title?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
    /** The version of the dataset. */
    version?: InputMaybe<SortOrder>;
}

export interface DisplayPropertyFilter {
    projectReferenceId?: InputMaybe<Scalars['String']['input']>;
    type?: InputMaybe<DisplayPropertyType>;
    typeReferenceId?: InputMaybe<Scalars['String']['input']>;
}

export enum DisplayPropertyType {
    DATASET = 'DATASET',
    PROJECT = 'PROJECT',
    SPECIMEN_TYPE = 'SPECIMEN_TYPE',
}

export interface EntityInput {
    entityType: EntityType;
    identifyingAttribute: Scalars['String']['input'];
}

export interface EntityRelationshipInput {
    sourceEntity: EntityInput;
    targetEntity: EntityInput;
}

export enum EntityType {
    AIO_SPECIMEN = 'AIO_SPECIMEN',
    ANNOTATION = 'ANNOTATION',
    CHILDREN_REFERENCE_ID = 'CHILDREN_REFERENCE_ID',
    CONTACT = 'CONTACT',
    DATA_COLLECTION = 'DATA_COLLECTION',
    DATA_COLLECTION_PROJECT = 'DATA_COLLECTION_PROJECT',
    DATA_CONTRIBUTOR = 'DATA_CONTRIBUTOR',
    DATA_CREATOR = 'DATA_CREATOR',
    DATA_PUBLICATION_YEAR = 'DATA_PUBLICATION_YEAR',
    DISPLAY_FEATURE = 'DISPLAY_FEATURE',
    GRANT = 'GRANT',
    HIGHLIGHTED_WEB_RESOURCE = 'HIGHLIGHTED_WEB_RESOURCE',
    IMAGE = 'IMAGE',
    LICENCE = 'LICENCE',
    MEASUREMENT = 'MEASUREMENT',
    MODALITY = 'MODALITY',
    PROJECT_DISPLAY_PROPERTY = 'PROJECT_DISPLAY_PROPERTY',
    PROJECT_REFERENCE_ID = 'PROJECT_REFERENCE_ID',
    PROTOCOL = 'PROTOCOL',
    PUBLICATION = 'PUBLICATION',
    RELATED_PROJECT = 'RELATED_PROJECT',
    RELATED_SPECIMENS = 'RELATED_SPECIMENS',
    SPECIES = 'SPECIES',
    SPECIMEN_COUNT = 'SPECIMEN_COUNT',
    SPECIMEN_FILE = 'SPECIMEN_FILE',
    SPECIMEN_TYPE = 'SPECIMEN_TYPE',
    SUB_PROGRAM = 'SUB_PROGRAM',
    TAXON = 'TAXON',
    TAXONOMIES = 'TAXONOMIES',
    TAXONOMY_NODE = 'TAXONOMY_NODE',
    TECHNIQUE = 'TECHNIQUE',
    WEB_RESOURCE = 'WEB_RESOURCE',
}

export enum ExportStatus {
    COMPLETE = 'COMPLETE',
    FAILURE = 'FAILURE',
    NO_DATA = 'NO_DATA',
    RUNNING = 'RUNNING',
}

/** Represents a ExternalReference entity. */
export interface ExternalReferenceFilterInput {
    and?: InputMaybe<Array<ExternalReferenceFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<ExternalReferenceFilterInput>>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    /** A URI to the external resource. */
    uri?: InputMaybe<UrlOperationFilterInput>;
    /** A UUID to the external resource. */
    uuid?: InputMaybe<ComparableGuidOperationFilterInput>;
}

export interface FeatureDisplayPropertyInput {
    featureType: FeatureTypeInput;
    isDefault: Scalars['Boolean']['input'];
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
}

export enum FeatureDisplayType {
    ANNOTATION = 'ANNOTATION',
    CATEGORICAL = 'CATEGORICAL',
    IMAGE = 'IMAGE',
    MEASUREMENT = 'MEASUREMENT',
    NUMERIC = 'NUMERIC',
    TREE = 'TREE',
}

/** A FeatureType distinguishes between the various types of features. */
export interface FeatureTypeFilterInput {
    and?: InputMaybe<Array<FeatureTypeFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The description for the FeatureType. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<FeatureTypeFilterInput>>;
    /** The reference id of the FeatureType that maps back to the Allen ontology. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The title of the FeatureType. */
    title?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

export interface FeatureTypeInput {
    description: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
    title: Scalars['String']['input'];
}

/** A FeatureType distinguishes between the various types of features. */
export interface FeatureTypeSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The description for the FeatureType. */
    description?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The reference id of the FeatureType that maps back to the Allen ontology. */
    referenceId?: InputMaybe<SortOrder>;
    /** The title of the FeatureType. */
    title?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
}

/** Unique feature type and value indexing. */
export interface FeatureTypeValueIndexFilterInput {
    and?: InputMaybe<Array<FeatureTypeValueIndexFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The FeatureType that we are indexing on. */
    featureType?: InputMaybe<FeatureTypeFilterInput>;
    /** The ID associated to the FeatureType we are indexing on. */
    featureTypeId?: InputMaybe<ComparableGuidOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The index of this FeatureTypeValueIndex. */
    index?: InputMaybe<ComparableInt32OperationFilterInput>;
    or?: InputMaybe<Array<FeatureTypeValueIndexFilterInput>>;
    /** The parent reference identifier of the feature type value index. */
    parentReferenceId?: InputMaybe<StringOperationFilterInput>;
    /** The priority ordering for sorting the feature type value index. */
    priorityOrder?: InputMaybe<ComparableInt32OperationFilterInput>;
    /** The reference identifier of the feature type value index. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
    /** The value of this FeatureTypeValueIndex. */
    value?: InputMaybe<StringOperationFilterInput>;
}

/** Unique feature type and value indexing. */
export interface FeatureTypeValueIndexSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The FeatureType that we are indexing on. */
    featureType?: InputMaybe<FeatureTypeSortInput>;
    /** The ID associated to the FeatureType we are indexing on. */
    featureTypeId?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The index of this FeatureTypeValueIndex. */
    index?: InputMaybe<SortOrder>;
    /** The parent reference identifier of the feature type value index. */
    parentReferenceId?: InputMaybe<SortOrder>;
    /** The priority ordering for sorting the feature type value index. */
    priorityOrder?: InputMaybe<SortOrder>;
    /** The reference identifier of the feature type value index. */
    referenceId?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
    /** The value of this FeatureTypeValueIndex. */
    value?: InputMaybe<SortOrder>;
}

export interface FileArchiveInput {
    name: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
}

export interface Filter {
    field?: InputMaybe<Scalars['field_String_pattern_id']['input']>;
    operator?: InputMaybe<FilterOperator>;
    value?: InputMaybe<Scalars['String']['input']>;
}

export enum FilterOperator {
    BETWEEN = 'BETWEEN',
    CONTAINED_IN = 'CONTAINED_IN',
    CONTAINS = 'CONTAINS',
    EQ = 'EQ',
    STARTS_WITH = 'STARTS_WITH',
}

export interface ImageInput {
    annotated?: InputMaybe<Scalars['Boolean']['input']>;
    bytes: Scalars['String']['input'];
    featureType: FeatureTypeInput;
    modality?: InputMaybe<Array<ModalityInput>>;
    referenceId: Scalars['String']['input'];
}

/** Filter operations for the JSON type. */
export interface JsonOperationFilterInput {
    and?: InputMaybe<Array<JsonOperationFilterInput>>;
    /** Key-value pair that is contained by this JSON value at the top level. */
    containedBy?: InputMaybe<Scalars['JSON']['input']>;
    /** Contains the key-value pair at the top-level. */
    contains?: InputMaybe<Scalars['JSON']['input']>;
    /** All of the strings are contained as top level keys within the JSON value. */
    containsAllKeys?: InputMaybe<Array<Scalars['String']['input']>>;
    /** Any of the strings are contained as top level keys within the JSON value. */
    containsAnyKeys?: InputMaybe<Array<Scalars['String']['input']>>;
    /** String is contained as a top level key within the JSON value. */
    containsKey?: InputMaybe<Scalars['String']['input']>;
    or?: InputMaybe<Array<JsonOperationFilterInput>>;
}

export interface LicenseInput {
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    title: Scalars['String']['input'];
    urlResource?: InputMaybe<UrlResourceInput>;
}

export interface ListExtendedStringOperationFilterInput {
    all?: InputMaybe<StringOperationFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<StringOperationFilterInput>;
    some?: InputMaybe<StringOperationFilterInput>;
}

export interface ListFilterInputTypeOfAnnotationFilterInput {
    all?: InputMaybe<AnnotationFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<AnnotationFilterInput>;
    some?: InputMaybe<AnnotationFilterInput>;
}

export interface ListFilterInputTypeOfCellPropertyFilterInput {
    all?: InputMaybe<CellPropertyFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<CellPropertyFilterInput>;
    some?: InputMaybe<CellPropertyFilterInput>;
}

export interface ListFilterInputTypeOfExternalReferenceFilterInput {
    all?: InputMaybe<ExternalReferenceFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<ExternalReferenceFilterInput>;
    some?: InputMaybe<ExternalReferenceFilterInput>;
}

export interface ListFilterInputTypeOfMetadataFilterInput {
    all?: InputMaybe<MetadataFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<MetadataFilterInput>;
    some?: InputMaybe<MetadataFilterInput>;
}

export interface ListFilterInputTypeOfVisualizationFilterInput {
    all?: InputMaybe<VisualizationFilterInput>;
    any?: InputMaybe<Scalars['Boolean']['input']>;
    none?: InputMaybe<VisualizationFilterInput>;
    some?: InputMaybe<VisualizationFilterInput>;
}

export enum MatrixAggregationCellMetadata {
    CLUSTER_LABEL = 'CLUSTER_LABEL',
}

export enum MatrixAggregationOperator {
    MEDIANS = 'MEDIANS',
    TRIMMED_MEANS = 'TRIMMED_MEANS',
}

export interface MeasurementInput {
    featureType: FeatureTypeInput;
    measurementType: MeasurementType;
    modality?: InputMaybe<Array<ModalityInput>>;
    referenceId: Scalars['String']['input'];
    unit?: InputMaybe<Scalars['String']['input']>;
    value?: InputMaybe<Scalars['String']['input']>;
}

export enum MeasurementType {
    QUALITATIVE = 'QUALITATIVE',
    QUANTITATIVE = 'QUANTITATIVE',
}

/** Holds arbitrary Metadata. Schema enforced by DataType relationship. */
export interface MetadataFilterInput {
    and?: InputMaybe<Array<MetadataFilterInput>>;
    /** The connection to a BKP Dataset. */
    bkpDataset?: InputMaybe<BkpDatasetFilterInput>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The Metadata itself. A JSON blob validated against the schema on the DataType. */
    data?: InputMaybe<JsonOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<MetadataFilterInput>>;
    /** The type of this Metadata. Used for validating schema and querying by DataType. */
    type?: InputMaybe<DataTypeFilterInput>;
    /** The foreign key for the Metadata type. */
    typeId?: InputMaybe<ComparableGuidOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

export interface ModalityInput {
    name: Scalars['String']['input'];
}

export enum NullDisplayOption {
    COLOR = 'COLOR',
    HIDE = 'HIDE',
    ZERO = 'ZERO',
}

/** Represents a base model for NumericColor records. */
export interface NumericColorFilterInput {
    and?: InputMaybe<Array<NumericColorFilterInput>>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The color for null values. */
    nullColor?: InputMaybe<StringOperationFilterInput>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<NumericColorFilterInput>>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/**
 * This allows us to distinguish whether the NumericColor we are providing information for
 * is a ColorMap or ColorGradient.
 */
export interface NumericColorInputDistinguisherFilterInput {
    and?: InputMaybe<Array<NumericColorInputDistinguisherFilterInput>>;
    /** The NumericColor we are providing information for is a ColorGradient. */
    colorGradient?: InputMaybe<ColorGradientFilterInput>;
    /** The NumericColor we are providing information for is a ColorMap. */
    colorMap?: InputMaybe<ColorMapFilterInput>;
    or?: InputMaybe<Array<NumericColorInputDistinguisherFilterInput>>;
}

/**
 * This allows us to distinguish whether the NumericColor we are providing information for
 * is a ColorMap or ColorGradient.
 */
export interface NumericColorInputDistinguisherSortInput {
    /** The NumericColor we are providing information for is a ColorGradient. */
    colorGradient?: InputMaybe<ColorGradientSortInput>;
    /** The NumericColor we are providing information for is a ColorMap. */
    colorMap?: InputMaybe<ColorMapSortInput>;
}

/** Represents a base model for NumericColor records. */
export interface NumericColorSortInput {
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The maximum clamp value for the color range. */
    maxClamp?: InputMaybe<SortOrder>;
    /** The minimum clamp value for the color range. */
    minClamp?: InputMaybe<SortOrder>;
    /** The color for null values. */
    nullColor?: InputMaybe<SortOrder>;
    /** The connection to a numeric property. */
    numericPropertyId?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
}

/** Numeric property holds values that will be used to describe the feature type. */
export interface NumericPropertyFilterInput {
    and?: InputMaybe<Array<NumericPropertyFilterInput>>;
    /** The average value for the property. */
    avg?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The coloring of the numeric property. */
    color?: InputMaybe<NumericColorFilterInput>;
    /** The coloring input of the numeric property. */
    colorInput?: InputMaybe<NumericColorInputDistinguisherFilterInput>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The dataset that the numeric property belongs to. */
    dataset?: InputMaybe<DatasetFilterInput>;
    /** The dataset that the numeric property belongs to. */
    datasetId?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The property's FeatureType. */
    featureType?: InputMaybe<FeatureTypeFilterInput>;
    /** The identifier of the FeatureType. */
    featureTypeId?: InputMaybe<ComparableGuidOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    /** The maximum value for the property. */
    max?: InputMaybe<ComparableSingleOperationFilterInput>;
    /** The minimum value for the property. */
    min?: InputMaybe<ComparableSingleOperationFilterInput>;
    or?: InputMaybe<Array<NumericPropertyFilterInput>>;
    /** The standard deviation value for the property. */
    std?: InputMaybe<ComparableSingleOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

/** Numeric property holds values that will be used to describe the feature type. */
export interface NumericPropertySortInput {
    /** The average value for the property. */
    avg?: InputMaybe<SortOrder>;
    /** The coloring of the numeric property. */
    color?: InputMaybe<NumericColorSortInput>;
    /** The coloring input of the numeric property. */
    colorInput?: InputMaybe<NumericColorInputDistinguisherSortInput>;
    createdAt?: InputMaybe<SortOrder>;
    createdBy?: InputMaybe<SortOrder>;
    /** The dataset that the numeric property belongs to. */
    dataset?: InputMaybe<DatasetSortInput>;
    /** The dataset that the numeric property belongs to. */
    datasetId?: InputMaybe<SortOrder>;
    /** The property's FeatureType. */
    featureType?: InputMaybe<FeatureTypeSortInput>;
    /** The identifier of the FeatureType. */
    featureTypeId?: InputMaybe<SortOrder>;
    id?: InputMaybe<SortOrder>;
    /** The maximum value for the property. */
    max?: InputMaybe<SortOrder>;
    /** The minimum value for the property. */
    min?: InputMaybe<SortOrder>;
    /** The standard deviation value for the property. */
    std?: InputMaybe<SortOrder>;
    updatedAt?: InputMaybe<SortOrder>;
    updatedBy?: InputMaybe<SortOrder>;
}

export interface OrganizationInput {
    name: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
    rorSymbol?: InputMaybe<Scalars['String']['input']>;
}

export interface PersonInput {
    ORCID?: InputMaybe<Scalars['String']['input']>;
    familyName: Scalars['String']['input'];
    givenName: Scalars['String']['input'];
    name: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
}

export interface ProgramInput {
    description: Scalars['String']['input'];
    informationWebResource?: InputMaybe<UrlResourceInput>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    title: Scalars['String']['input'];
}

export enum ProjectCapabilities {
    BKP_DATASET = 'BKP_DATASET',
    OME_ZARR = 'OME_ZARR',
}

export interface ProjectDisplayPropertyInput {
    defaultFilter?: InputMaybe<Array<Filter>>;
    defaultSort?: InputMaybe<Array<Sort>>;
    displayFeatures: Array<FeatureDisplayPropertyInput>;
    projectReferenceId?: InputMaybe<Scalars['String']['input']>;
}

export interface PublicationInput {
    author: PersonInput;
    doiSymbol: Scalars['String']['input'];
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    publicationYear: Scalars['String']['input'];
    pubmedId?: InputMaybe<Scalars['String']['input']>;
    referenceId: Scalars['String']['input'];
    title?: InputMaybe<Scalars['String']['input']>;
}

export interface PublisherInput {
    organization: OrganizationInput;
}

export interface RangeGroupBy {
    field?: InputMaybe<Scalars['field_String_pattern_id']['input']>;
    range?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
}

/** This defines the range group by input */
export interface RangeGroupByInput {
    /** The field property for RangeGroupBy. */
    field: Scalars['String']['input'];
    /** The range property of the RangeGroupBy. */
    range: Array<InputMaybe<Scalars['String']['input']>>;
}

export interface RelatedDataCollectionProjectInput {
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
}

export interface RelatedSpecimenInput {
    relationship: SpecimenRelationshipInputType;
    specimenReferenceIds: Array<Scalars['String']['input']>;
}

export interface Sort {
    field?: InputMaybe<Scalars['field_String_pattern_id']['input']>;
    order?: InputMaybe<SortOrder>;
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

export interface SpeciesInput {
    name: Scalars['String']['input'];
}

export enum SpecimenBundleType {
    MANIFEST = 'MANIFEST',
    METADATA = 'METADATA',
}

export interface SpecimenCountInput {
    specimenCount?: InputMaybe<Scalars['Int']['input']>;
    specimenType: SpecimenTypeInput;
}

export interface SpecimenFileInput {
    archive?: InputMaybe<FileArchiveInput>;
    checksum?: InputMaybe<Scalars['String']['input']>;
    name: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
    type: Scalars['String']['input'];
    uri: Scalars['String']['input'];
}

export enum SpecimenRelationship {
    DERIVES = 'DERIVES',
    DERIVES_FROM = 'DERIVES_FROM',
}

export enum SpecimenRelationshipInputType {
    DERIVES_FROM = 'DERIVES_FROM',
}

export interface SpecimenTypeDisplayPropertyInput {
    defaultFilter?: InputMaybe<Array<Filter>>;
    defaultSort?: InputMaybe<Array<Sort>>;
    displayFeatures: Array<FeatureDisplayPropertyInput>;
    projectReferenceId: Scalars['String']['input'];
    specimenTypeReferenceId: Scalars['String']['input'];
}

export interface SpecimenTypeInput {
    name: Scalars['String']['input'];
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId?: InputMaybe<Scalars['String']['input']>;
}

export enum SpecimensViewTitle {
    LIST = 'LIST',
    PROPERTIES = 'PROPERTIES',
}

/** Filter operations for both case-sensitive and case-insensitve string. */
export interface StringOperationFilterInput {
    and?: InputMaybe<Array<StringOperationFilterInput>>;
    contains?: InputMaybe<Scalars['String']['input']>;
    /** Performs a case-insensitive contains comparison. */
    containsInsensitive?: InputMaybe<Scalars['String']['input']>;
    endsWith?: InputMaybe<Scalars['String']['input']>;
    /** Performs a case-insensitive ends with comparison. */
    endsWithInsensitive?: InputMaybe<Scalars['String']['input']>;
    eq?: InputMaybe<Scalars['String']['input']>;
    /** Performs a case-insensitive equality comparison. */
    eqInsensitive?: InputMaybe<Scalars['String']['input']>;
    in?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
    ncontains?: InputMaybe<Scalars['String']['input']>;
    nendsWith?: InputMaybe<Scalars['String']['input']>;
    neq?: InputMaybe<Scalars['String']['input']>;
    nin?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
    nstartsWith?: InputMaybe<Scalars['String']['input']>;
    or?: InputMaybe<Array<StringOperationFilterInput>>;
    startsWith?: InputMaybe<Scalars['String']['input']>;
    /** Performs a case-insensitive starts with comparison. */
    startsWithInsensitive?: InputMaybe<Scalars['String']['input']>;
}

export interface SubProgramInput {
    description: Scalars['String']['input'];
    informationWebResource?: InputMaybe<UrlResourceInput>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    program?: InputMaybe<ProgramInput>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    title: Scalars['String']['input'];
}

/** An SVG annotation. */
export interface SvgAnnotationInput {
    /** The type of the SVG annotation. */
    annotationType: AnnotationType;
    /** The url for the SVG annotation. */
    baseUrl: Scalars['URL']['input'];
    /** The description for the annotation. */
    description: Scalars['String']['input'];
    /** The priority order for sorting the annotation. */
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    /** The reference identifier of the annotation. */
    referenceId: Scalars['String']['input'];
    /** The short title of the annotation. */
    shortTitle: Scalars['String']['input'];
    /** The title of the annotation. */
    title: Scalars['String']['input'];
}

export interface TaxonInput {
    cRID: CRIDInput;
    description: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
    symbol: Scalars['String']['input'];
}

export interface TaxonomyInput {
    description: Scalars['String']['input'];
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    taxonomyNodes?: InputMaybe<Array<TaxonomyNodeInput>>;
    title: Scalars['String']['input'];
    type: TaxonomyType;
}

export interface TaxonomyNodeInput {
    childrenReferenceIds?: InputMaybe<Array<Scalars['String']['input']>>;
    color?: InputMaybe<Scalars['String']['input']>;
    description: Scalars['String']['input'];
    featureTypeReferenceId?: InputMaybe<Scalars['String']['input']>;
    parentReferenceId?: InputMaybe<Scalars['String']['input']>;
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    taxon: TaxonInput;
    title: Scalars['String']['input'];
}

export enum TaxonomyType {
    CLASS_HIERARCHY = 'CLASS_HIERARCHY',
}

export interface TechniqueInput {
    name: Scalars['String']['input'];
}

export enum TypeState {
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED',
    DEPRECATED = 'DEPRECATED',
    PENDING_REVIEW = 'PENDING_REVIEW',
}

export interface TypeStateOperationFilterInput {
    eq?: InputMaybe<TypeState>;
    in?: InputMaybe<Array<TypeState>>;
    neq?: InputMaybe<TypeState>;
    nin?: InputMaybe<Array<TypeState>>;
}

export interface UrlOperationFilterInput {
    eq?: InputMaybe<Scalars['URL']['input']>;
    gt?: InputMaybe<Scalars['URL']['input']>;
    gte?: InputMaybe<Scalars['URL']['input']>;
    in?: InputMaybe<Array<InputMaybe<Scalars['URL']['input']>>>;
    lt?: InputMaybe<Scalars['URL']['input']>;
    lte?: InputMaybe<Scalars['URL']['input']>;
    neq?: InputMaybe<Scalars['URL']['input']>;
    ngt?: InputMaybe<Scalars['URL']['input']>;
    ngte?: InputMaybe<Scalars['URL']['input']>;
    nin?: InputMaybe<Array<InputMaybe<Scalars['URL']['input']>>>;
    nlt?: InputMaybe<Scalars['URL']['input']>;
    nlte?: InputMaybe<Scalars['URL']['input']>;
}

export interface UrlResourceInput {
    priorityOrder?: InputMaybe<Scalars['Int']['input']>;
    referenceId: Scalars['String']['input'];
    shortTitle: Scalars['String']['input'];
    title: Scalars['String']['input'];
    type: Scalars['String']['input'];
    url: Scalars['String']['input'];
}

/** Represents a base model for Visualization records. */
export interface VisualizationFilterInput {
    and?: InputMaybe<Array<VisualizationFilterInput>>;
    /** The annotations for the Visualization. */
    annotations?: InputMaybe<ListFilterInputTypeOfAnnotationFilterInput>;
    /** The connection to a BKP Dataset. */
    bkpDataset?: InputMaybe<BkpDatasetFilterInput>;
    createdAt?: InputMaybe<ComparableDateTimeOperationFilterInput>;
    createdBy?: InputMaybe<StringOperationFilterInput>;
    /** The description of the Visualization. */
    description?: InputMaybe<StringOperationFilterInput>;
    id?: InputMaybe<ComparableGuidOperationFilterInput>;
    or?: InputMaybe<Array<VisualizationFilterInput>>;
    /** The priority order of the Visualization. */
    priorityOrder?: InputMaybe<ComparableNullableOfInt32OperationFilterInput>;
    /** The reference id for the Visualization. */
    referenceId?: InputMaybe<StringOperationFilterInput>;
    /** The short title of the Visualization. */
    shortTitle?: InputMaybe<StringOperationFilterInput>;
    /** The title of the Visualization. */
    title?: InputMaybe<StringOperationFilterInput>;
    updatedAt?: InputMaybe<ComparableNullableOfDateTimeOperationFilterInput>;
    updatedBy?: InputMaybe<StringOperationFilterInput>;
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
    AIO_SpecimenFacetedSearchPropertyType: true,
    AggregationOperator: true,
    AnnotationType: true,
    BffFilterOperator: true,
    BffSortOrder: true,
    Boolean: true,
    ByteArray: true,
    CacheControlScope: true,
    CellFilterType: true,
    ColorType: true,
    Date: true,
    DateTime: true,
    DisplayPropertyType: true,
    EntityType: true,
    ExportStatus: true,
    FeatureDisplayType: true,
    FilterOperator: true,
    Float: true,
    Int: true,
    JSON: true,
    MatrixAggregationCellMetadata: true,
    MatrixAggregationOperator: true,
    MeasurementType: true,
    NullDisplayOption: true,
    ProjectCapabilities: true,
    SortOrder: true,
    SpecimenBundleType: true,
    SpecimenRelationship: true,
    SpecimenRelationshipInputType: true,
    SpecimensViewTitle: true,
    String: true,
    TaxonomyType: true,
    TypeState: true,
    URL: true,
    UUID: true,
    field_String_pattern_id: true,
    groupBy_List_String_pattern_id: true,
};
export const generatedSchema = {
    ABCAtlasDefaultOptions: {
        __typename: { __type: 'String!' },
        dataCollectionId: { __type: 'String' },
        filterFeatures: { __type: '[String!]!' },
        filterState: { __type: '[BffFilterType!]!' },
        listImageFeatures: { __type: '[String!]!' },
        sortState: { __type: '[BffSortType!]!' },
        summaryFeatures: { __type: '[String!]!' },
        tableColumnFeatures: { __type: '[String!]!' },
    },
    AIO_Grant: {
        __typename: { __type: 'String!' },
        awardee: { __type: 'Organization!' },
        fundingAgency: { __type: 'Organization!' },
        grantId: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        reportSymbol: { __type: 'String' },
        title: { __type: 'String!' },
    },
    AIO_GrantInput: {
        awardee: { __type: 'OrganizationInput!' },
        fundingAgency: { __type: 'OrganizationInput!' },
        grantId: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        reportSymbol: { __type: 'String' },
        title: { __type: 'String!' },
    },
    AIO_Project: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        $on: { __type: '$AIO_Project!' },
    },
    AIO_Protocol: {
        __typename: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        url: { __type: 'String!' },
    },
    AIO_ProtocolInput: {
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        urlResource: { __type: 'UrlResourceInput!' },
    },
    AIO_Specimen: {
        __typename: { __type: 'String!' },
        annotations: { __type: '[Annotation!]', __args: { featureTypes: '[String]' } },
        cRID: { __type: 'CRID!' },
        files: { __type: '[SpecimenFile!]' },
        images: { __type: '[Image!]', __args: { featureTypes: '[String]' } },
        measurements: { __type: '[Measurement!]', __args: { featureTypes: '[String]' } },
        projectReferenceIds: { __type: '[String!]!' },
        referenceId: { __type: 'String!' },
        relatedSpecimens: { __type: '[RelatedSpecimen!]' },
        specimenType: { __type: 'SpecimenType' },
    },
    AIO_SpecimenFacetedSearchProperty: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        measurementStats: { __type: 'MeasurementStats' },
        modality: { __type: '[Modality!]' },
        type: { __type: 'AIO_SpecimenFacetedSearchPropertyType!' },
    },
    AIO_SpecimenInput: {
        annotations: { __type: '[AnnotationInput!]' },
        cRID: { __type: 'CRIDInput!' },
        files: { __type: '[SpecimenFileInput!]' },
        images: { __type: '[ImageInput!]' },
        measurements: { __type: '[MeasurementInput!]' },
        projectReferenceIds: { __type: '[String!]!' },
        referenceId: { __type: 'String!' },
        relatedSpecimens: { __type: '[RelatedSpecimenInput!]' },
        specimenType: { __type: 'SpecimenTypeInput!' },
    },
    AggregationOperation: { field: { __type: 'String' }, operator: { __type: 'AggregationOperator' } },
    AggregationResult: {
        __typename: { __type: 'String!' },
        count: { __type: 'Float' },
        properties: { __type: '[PropertyValueTuple]' },
    },
    Annotation: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        modality: { __type: '[Modality!]' },
        referenceId: { __type: 'String!' },
        taxons: { __type: '[Taxon!]!' },
    },
    AnnotationDisplayProperty: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
    },
    AnnotationFeature: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        default: { __type: 'Boolean!' },
        featureType: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    AnnotationFeatureInput: {
        default: { __type: 'Boolean!' },
        featureTypeId: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int' },
    },
    AnnotationFilterInput: {
        and: { __type: '[AnnotationFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[AnnotationFilterInput!]' },
        priorityOrder: { __type: 'ComparableNullableOfInt32OperationFilterInput' },
        referenceId: { __type: 'StringOperationFilterInput' },
        shortTitle: { __type: 'StringOperationFilterInput' },
        title: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    AnnotationInput: {
        featureType: { __type: 'FeatureTypeInput!' },
        modality: { __type: '[ModalityInput!]' },
        referenceId: { __type: 'String!' },
        svgAnnotation: { __type: 'SvgAnnotationInput' },
        taxons: { __type: '[TaxonInput!]!' },
    },
    BffContact: { __typename: { __type: 'String!' }, email: { __type: 'WebResourceLink' }, name: { __type: 'String' } },
    BffFilter: { field: { __type: 'String' }, operator: { __type: 'BffFilterOperator' }, value: { __type: 'String' } },
    BffFilterType: {
        __typename: { __type: 'String!' },
        field: { __type: 'String' },
        operator: { __type: 'BffFilterOperator' },
        value: { __type: 'String' },
    },
    BffProgram: {
        __typename: { __type: 'String!' },
        programLink: { __type: 'WebResourceLink' },
        subProgramLink: { __type: 'WebResourceLink' },
    },
    BffProject: {
        __typename: { __type: 'String!' },
        program: { __type: 'String' },
        projectLink: { __type: 'WebResourceLink' },
        subProgram: { __type: 'String' },
    },
    BffPublication: {
        __typename: { __type: 'String!' },
        doiLink: { __type: 'WebResourceLink' },
        name: { __type: 'String' },
        pubMedLink: { __type: 'WebResourceLink' },
        year: { __type: 'String' },
    },
    BffSort: { field: { __type: 'String' }, order: { __type: 'BffSortOrder' } },
    BffSortType: { __typename: { __type: 'String!' }, field: { __type: 'String' }, order: { __type: 'BffSortOrder' } },
    BkpDataset: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        dataCollectionReferenceId: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        metadata: { __type: '[Metadata!]!' },
        priorityOrder: { __type: 'Int!' },
        projectReferenceId: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        version: { __type: 'String!' },
        visualizations: { __type: '[IVisualization!]!' },
    },
    BkpDatasetFilterInput: {
        and: { __type: '[BkpDatasetFilterInput!]' },
        cellProperties: { __type: 'ListFilterInputTypeOfCellPropertyFilterInput' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        dataCollectionReferenceId: { __type: 'StringOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        metadata: { __type: 'ListFilterInputTypeOfMetadataFilterInput' },
        or: { __type: '[BkpDatasetFilterInput!]' },
        priorityOrder: { __type: 'ComparableNullableOfInt32OperationFilterInput' },
        projectReferenceId: { __type: 'StringOperationFilterInput' },
        referenceId: { __type: 'StringOperationFilterInput' },
        shortTitle: { __type: 'StringOperationFilterInput' },
        title: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        version: { __type: 'StringOperationFilterInput' },
        visualizations: { __type: 'ListFilterInputTypeOfVisualizationFilterInput' },
    },
    BkpDatasetSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        dataCollectionReferenceId: { __type: 'SortOrder' },
        description: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        priorityOrder: { __type: 'SortOrder' },
        projectReferenceId: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        shortTitle: { __type: 'SortOrder' },
        state: { __type: 'SortOrder' },
        title: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
        version: { __type: 'SortOrder' },
    },
    BkpDatasetsConnection: {
        __typename: { __type: 'String!' },
        edges: { __type: '[BkpDatasetsEdge!]' },
        nodes: { __type: '[BkpDataset!]' },
        pageInfo: { __type: 'PageInfo!' },
        totalCount: { __type: 'Int!' },
    },
    BkpDatasetsEdge: {
        __typename: { __type: 'String!' },
        cursor: { __type: 'String!' },
        node: { __type: 'BkpDataset!' },
    },
    BooleanOperationFilterInput: { eq: { __type: 'Boolean' }, neq: { __type: 'Boolean' } },
    BroadClass: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    CRID: { __typename: { __type: 'String!' }, registry: { __type: 'CRIDRegistry!' }, symbol: { __type: 'String!' } },
    CRIDInput: { registry: { __type: 'CRIDRegistryInput!' }, symbol: { __type: 'String!' } },
    CRIDRegistry: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
    },
    CRIDRegistryInput: { description: { __type: 'String!' }, referenceId: { __type: 'String!' } },
    CVImage: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        properties: { __type: 'CVImageProperty' },
        referenceId: { __type: 'String!' },
        url: { __type: 'String!' },
    },
    CVImageProperty: {
        __typename: { __type: 'String!' },
        cellType: { __type: 'String' },
        comparisonType: { __type: 'String' },
        gene: { __type: 'String' },
        metaData: { __type: 'String' },
        projectReferenceId: { __type: 'String!' },
    },
    CVImagePropertyInput: {
        cellType: { __type: 'String!' },
        comparisonType: { __type: 'String!' },
        gene: { __type: 'String!' },
        metaData: { __type: 'String!' },
        projectReferenceId: { __type: 'String!' },
    },
    CVProperties: {
        __typename: { __type: 'String!' },
        cellType: { __type: '[String!]!' },
        comparisonType: { __type: '[String!]!' },
        gene: { __type: '[String!]!', __args: { exact: 'Boolean', limit: 'Int', sort: 'SortOrder', text: 'String' } },
        metaData: { __type: '[String!]!' },
    },
    CategoricalDisplayProperty: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
    },
    CellFilterInput: {
        field: { __type: 'String' },
        operator: { __type: 'FilterOperator' },
        type: { __type: 'CellFilterType!' },
        value: { __type: 'String' },
    },
    CellGene: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        dataCollectionId: { __type: 'String!' },
        genome: { __type: 'String!' },
        id: { __type: 'UUID!' },
        index: { __type: 'Int!' },
        max: { __type: 'Float!' },
        min: { __type: 'Float!' },
        referenceId: { __type: 'String!' },
        symbol: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        version: { __type: 'String!' },
    },
    CellGeneFilterInput: {
        and: { __type: '[CellGeneFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        dataCollectionId: { __type: 'StringOperationFilterInput' },
        genome: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        index: { __type: 'ComparableInt32OperationFilterInput' },
        max: { __type: 'ComparableSingleOperationFilterInput' },
        min: { __type: 'ComparableSingleOperationFilterInput' },
        or: { __type: '[CellGeneFilterInput!]' },
        referenceId: { __type: 'StringOperationFilterInput' },
        symbol: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        version: { __type: 'StringOperationFilterInput' },
    },
    CellGeneSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        dataCollectionId: { __type: 'SortOrder' },
        genome: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        index: { __type: 'SortOrder' },
        max: { __type: 'SortOrder' },
        min: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        symbol: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
        version: { __type: 'SortOrder' },
    },
    CellGenesConnection: {
        __typename: { __type: 'String!' },
        edges: { __type: '[CellGenesEdge!]' },
        nodes: { __type: '[CellGene!]' },
        pageInfo: { __type: 'PageInfo!' },
        totalCount: { __type: 'Int!' },
    },
    CellGenesEdge: { __typename: { __type: 'String!' }, cursor: { __type: 'String!' }, node: { __type: 'CellGene!' } },
    CellInfo: {
        __typename: { __type: 'String!' },
        id: { __type: 'String' },
        index: { __type: 'Int' },
        properties: { __type: '[PropertyValueTuple]' },
    },
    CellPropertiesConnection: {
        __typename: { __type: 'String!' },
        edges: { __type: '[CellPropertiesEdge!]' },
        nodes: { __type: '[CellProperty!]' },
        pageInfo: { __type: 'PageInfo!' },
        totalCount: { __type: 'Int!' },
    },
    CellPropertiesEdge: {
        __typename: { __type: 'String!' },
        cursor: { __type: 'String!' },
        node: { __type: 'CellProperty!' },
    },
    CellProperty: {
        __typename: { __type: 'String!' },
        color: { __type: 'String' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        dataset: { __type: 'IDataset' },
        featureType: { __type: 'FeatureType!' },
        featureTypeValueIndex: { __type: 'FeatureTypeValueIndex!' },
        id: { __type: 'UUID!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    CellPropertyFilterInput: {
        and: { __type: '[CellPropertyFilterInput!]' },
        color: { __type: 'StringOperationFilterInput' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        dataset: { __type: 'DatasetFilterInput' },
        featureType: { __type: 'FeatureTypeFilterInput' },
        featureTypeValueIndex: { __type: 'FeatureTypeValueIndexFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[CellPropertyFilterInput!]' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    CellPropertySortInput: {
        color: { __type: 'SortOrder' },
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        dataCollectionId: { __type: 'SortOrder' },
        dataset: { __type: 'DatasetSortInput' },
        datasetId: { __type: 'SortOrder' },
        featureType: { __type: 'FeatureTypeSortInput' },
        featureTypeId: { __type: 'SortOrder' },
        featureTypeValueIndex: { __type: 'FeatureTypeValueIndexSortInput' },
        featureTypeValueIndexId: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        index: { __type: 'SortOrder' },
        parentReferenceId: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
        value: { __type: 'SortOrder' },
    },
    CellTypeAnatomyImage: { __typename: { __type: 'String!' }, alt: { __type: 'String' }, src: { __type: 'String' } },
    CellTypeTaxonomy: {
        __typename: { __type: 'String!' },
        name: { __type: 'String' },
        nodes: { __type: '[CellTypeTaxonomyNode]' },
    },
    CellTypeTaxonomyHierarchyNode: {
        __typename: { __type: 'String!' },
        accessionId: { __type: 'String!' },
        aliases: { __type: '[String!]' },
        classLabel: { __type: 'String' },
        color: { __type: 'String' },
        dataSections: { __type: 'JSON', __args: { taxonomyId: 'String' } },
        fullOntologyName: { __type: 'String' },
        id: { __type: 'String' },
        label: { __type: 'String' },
        nfForestMarkers: { __type: '[WebResourceLink!]' },
        ontologyIri: { __type: 'WebResourceLink' },
        parentId: { __type: 'String' },
        rank: { __type: 'String' },
        references: { __type: '[String!]' },
        summary: { __type: 'String' },
        symbol: { __type: 'String' },
        tags: { __type: '[String]' },
    },
    CellTypeTaxonomyInfo: {
        __typename: { __type: 'String!' },
        accessionId: { __type: 'String!' },
        age: { __type: 'String' },
        anatomy: { __type: 'String' },
        anatomyImages: { __type: '[CellTypeAnatomyImage]' },
        attribution: { __type: 'String' },
        azimuthHeader: { __type: 'String' },
        azimuthLink: { __type: 'String' },
        azimuthText: { __type: 'String' },
        cellClassesCount: { __type: 'String' },
        cellSubclassesCount: { __type: 'String' },
        cellTypesCount: { __type: 'String' },
        crossSpeciesImages: { __type: '[String!]' },
        datasets: { __type: '[CellTypesDatasetInfo]', __args: { taxonomyId: 'String' } },
        header: { __type: 'String' },
        mainDescription: { __type: 'String' },
        nodes: { __type: '[CellTypeTaxonomyHierarchyNode!]', __args: { accessionId: 'String' } },
        sex: { __type: 'String' },
        species: { __type: 'String' },
        subDescription: { __type: 'String' },
    },
    CellTypeTaxonomyNode: {
        __typename: { __type: 'String!' },
        accessionId: { __type: 'String' },
        alias: { __type: 'String' },
        childrenIds: { __type: '[String]' },
        color: { __type: 'String' },
        label: { __type: 'String' },
        order: { __type: 'Int' },
        parentId: { __type: 'String' },
    },
    CellTypesDatasetInfo: {
        __typename: { __type: 'String!' },
        cellsNuclei: { __type: 'String' },
        dataset: { __type: 'String' },
        downloadLink: { __type: 'String' },
        exploreLink: { __type: 'String' },
        text: { __type: 'String' },
    },
    Cluster: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    ColorGradient: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        gradient: { __type: '[String!]!' },
        id: { __type: 'UUID!' },
        maxClamp: { __type: 'Float!' },
        minClamp: { __type: 'Float!' },
        nullColor: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    ColorGradientFilterInput: {
        and: { __type: '[ColorGradientFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        gradient: { __type: 'ListExtendedStringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        maxClamp: { __type: 'ComparableSingleOperationFilterInput' },
        minClamp: { __type: 'ComparableSingleOperationFilterInput' },
        nullColor: { __type: 'StringOperationFilterInput' },
        numericPropertyId: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[ColorGradientFilterInput!]' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    ColorGradientSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        maxClamp: { __type: 'SortOrder' },
        minClamp: { __type: 'SortOrder' },
        nullColor: { __type: 'SortOrder' },
        numericPropertyId: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
    },
    ColorMap: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        id: { __type: 'UUID!' },
        invertMap: { __type: 'Boolean!' },
        maxClamp: { __type: 'Float!' },
        minClamp: { __type: 'Float!' },
        name: { __type: 'String!' },
        nullColor: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    ColorMapFilterInput: {
        and: { __type: '[ColorMapFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        invertMap: { __type: 'BooleanOperationFilterInput' },
        maxClamp: { __type: 'ComparableSingleOperationFilterInput' },
        minClamp: { __type: 'ComparableSingleOperationFilterInput' },
        name: { __type: 'StringOperationFilterInput' },
        nullColor: { __type: 'StringOperationFilterInput' },
        numericPropertyId: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[ColorMapFilterInput!]' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    ColorMapSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        invertMap: { __type: 'SortOrder' },
        maxClamp: { __type: 'SortOrder' },
        minClamp: { __type: 'SortOrder' },
        name: { __type: 'SortOrder' },
        nullColor: { __type: 'SortOrder' },
        numericPropertyId: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
    },
    ColorSetInfo: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        type: { __type: 'ColorType!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    ComparableDateTimeOperationFilterInput: {
        eq: { __type: 'DateTime' },
        gt: { __type: 'DateTime' },
        gte: { __type: 'DateTime' },
        in: { __type: '[DateTime!]' },
        lt: { __type: 'DateTime' },
        lte: { __type: 'DateTime' },
        neq: { __type: 'DateTime' },
        ngt: { __type: 'DateTime' },
        ngte: { __type: 'DateTime' },
        nin: { __type: '[DateTime!]' },
        nlt: { __type: 'DateTime' },
        nlte: { __type: 'DateTime' },
    },
    ComparableGuidOperationFilterInput: {
        eq: { __type: 'UUID' },
        gt: { __type: 'UUID' },
        gte: { __type: 'UUID' },
        in: { __type: '[UUID!]' },
        lt: { __type: 'UUID' },
        lte: { __type: 'UUID' },
        neq: { __type: 'UUID' },
        ngt: { __type: 'UUID' },
        ngte: { __type: 'UUID' },
        nin: { __type: '[UUID!]' },
        nlt: { __type: 'UUID' },
        nlte: { __type: 'UUID' },
    },
    ComparableInt32OperationFilterInput: {
        eq: { __type: 'Int' },
        gt: { __type: 'Int' },
        gte: { __type: 'Int' },
        in: { __type: '[Int!]' },
        lt: { __type: 'Int' },
        lte: { __type: 'Int' },
        neq: { __type: 'Int' },
        ngt: { __type: 'Int' },
        ngte: { __type: 'Int' },
        nin: { __type: '[Int!]' },
        nlt: { __type: 'Int' },
        nlte: { __type: 'Int' },
    },
    ComparableNullableOfDateTimeOperationFilterInput: {
        eq: { __type: 'DateTime' },
        gt: { __type: 'DateTime' },
        gte: { __type: 'DateTime' },
        in: { __type: '[DateTime]' },
        lt: { __type: 'DateTime' },
        lte: { __type: 'DateTime' },
        neq: { __type: 'DateTime' },
        ngt: { __type: 'DateTime' },
        ngte: { __type: 'DateTime' },
        nin: { __type: '[DateTime]' },
        nlt: { __type: 'DateTime' },
        nlte: { __type: 'DateTime' },
    },
    ComparableNullableOfInt32OperationFilterInput: {
        eq: { __type: 'Int' },
        gt: { __type: 'Int' },
        gte: { __type: 'Int' },
        in: { __type: '[Int]' },
        lt: { __type: 'Int' },
        lte: { __type: 'Int' },
        neq: { __type: 'Int' },
        ngt: { __type: 'Int' },
        ngte: { __type: 'Int' },
        nin: { __type: '[Int]' },
        nlt: { __type: 'Int' },
        nlte: { __type: 'Int' },
    },
    ComparableSingleOperationFilterInput: {
        eq: { __type: 'Float' },
        gt: { __type: 'Float' },
        gte: { __type: 'Float' },
        in: { __type: '[Float!]' },
        lt: { __type: 'Float' },
        lte: { __type: 'Float' },
        neq: { __type: 'Float' },
        ngt: { __type: 'Float' },
        ngte: { __type: 'Float' },
        nin: { __type: '[Float!]' },
        nlt: { __type: 'Float' },
        nlte: { __type: 'Float' },
    },
    Contact: {
        __typename: { __type: 'String!' },
        email: { __type: 'String!' },
        person: { __type: 'Person!' },
        priorityOrder: { __type: 'Int' },
    },
    ContactArrayDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[BffContact!]' },
    },
    ContactInput: {
        email: { __type: 'String!' },
        person: { __type: 'PersonInput!' },
        priorityOrder: { __type: 'Int' },
    },
    CoronalGrid: {
        __typename: { __type: 'String!' },
        annotations: { __type: '[IAnnotation!]!' },
        color: { __type: '[IColorInfo!]!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        url: { __type: 'URL!' },
    },
    CorticalLayer: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    DataCollection: {
        __typename: { __type: 'String!' },
        accessControl: { __type: 'String' },
        completionState: { __type: 'String' },
        description: { __type: 'String!' },
        lastUpdatedAtDate: { __type: 'Date' },
        modality: { __type: '[Modality]' },
        priorityOrder: { __type: 'Int' },
        publication: { __type: '[Publication]' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        species: { __type: '[Species]' },
        specimenCount: { __type: '[SpecimenCount]' },
        specimenType: { __type: '[SpecimenType]' },
        technique: { __type: '[Technique]' },
        title: { __type: 'String!' },
        webResources: { __type: '[UrlResource]' },
    },
    DataCollectionDisplay: {
        __typename: { __type: 'String!' },
        accessControl: { __type: 'StringDisplayProperty' },
        completionState: { __type: 'StringDisplayProperty' },
        description: { __type: 'StringDisplayProperty' },
        lastUpdatedAtDate: { __type: 'StringDisplayProperty' },
        modality: { __type: 'StringArrayDisplayProperty' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'StringDisplayProperty!' },
        species: { __type: 'StringArrayDisplayProperty' },
        specimenType: { __type: 'StringArrayDisplayProperty' },
        technique: { __type: 'StringArrayDisplayProperty' },
        totalSpecimenCount: { __type: 'IntDisplayProperty' },
        webResources: { __type: 'WebResourceLinkArrayDisplayProperty' },
    },
    DataCollectionDisplayProject: {
        __typename: { __type: 'String!' },
        associationsHeader: { __type: 'PropertyDisplayNameMetadata' },
        capabilities: { __type: '[ProjectCapabilities]' },
        citation: { __type: 'StringDisplayProperty' },
        contact: { __type: 'ContactArrayDisplayProperty' },
        contributor: { __type: 'WebResourceLinkArrayDisplayProperty' },
        dataCollection: { __type: '[DataCollectionDisplay]' },
        dataCollectionsHeader: { __type: 'PropertyDisplayNameMetadata' },
        dataCreator: { __type: 'StringArrayDisplayProperty' },
        description: { __type: 'StringDisplayProperty' },
        detailsHeader: { __type: 'PropertyDisplayNameMetadata' },
        doi: { __type: 'WebResourceLinkDisplayProperty' },
        fundingHeader: { __type: 'PropertyDisplayNameMetadata' },
        grant: { __type: '[WebResourceLink]' },
        hasSpecimensPage: { __type: 'Boolean!' },
        highlightedWebResources: { __type: 'WebResourceLinkArrayDisplayProperty' },
        license: { __type: 'WebResourceLinkArrayDisplayProperty' },
        modality: { __type: 'StringArrayDisplayProperty' },
        program: { __type: 'ProgramDisplayProperty' },
        programShortTitle: { __type: 'StringDisplayProperty' },
        project: { __type: 'ProjectDisplayArrayProperty' },
        projectDescription: { __type: 'PropertyDisplayNameMetadata' },
        protocol: { __type: '[WebResourceLink]' },
        protocolHeader: { __type: 'PropertyDisplayNameMetadata' },
        publication: { __type: 'PublicationDisplayProperty' },
        publisher: { __type: 'WebResourceLinkDisplayProperty' },
        publishingInfoHeader: { __type: 'PropertyDisplayNameMetadata' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'StringDisplayProperty!' },
        species: { __type: 'StringArrayDisplayProperty' },
        specimenType: { __type: 'StringArrayDisplayProperty' },
        subProgramShortTitle: { __type: 'StringDisplayProperty' },
        technique: { __type: 'StringArrayDisplayProperty' },
        title: { __type: 'StringDisplayProperty!' },
        year: { __type: 'StringArrayDisplayProperty' },
    },
    DataCollectionInput: {
        accessControl: { __type: 'String' },
        completionState: { __type: 'String' },
        description: { __type: 'String!' },
        lastUpdatedAtDate: { __type: 'Date' },
        modality: { __type: '[ModalityInput]' },
        priorityOrder: { __type: 'Int' },
        publication: { __type: '[PublicationInput]' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        species: { __type: '[SpeciesInput]' },
        specimenCount: { __type: '[SpecimenCountInput]' },
        specimenType: { __type: '[SpecimenTypeInput]' },
        technique: { __type: '[TechniqueInput]' },
        title: { __type: 'String!' },
        webResources: { __type: '[UrlResourceInput]' },
    },
    DataCollectionProject: {
        __typename: { __type: 'String!' },
        capabilities: { __type: '[ProjectCapabilities]' },
        citation: { __type: 'String' },
        contact: { __type: '[Contact]' },
        dataCollection: { __type: '[DataCollection]' },
        dataContributor: { __type: '[DataContributor]' },
        dataCreator: { __type: '[DataCreator]' },
        dataPublicationYear: { __type: '[String]' },
        description: { __type: 'String!' },
        doiSymbol: { __type: 'String' },
        grant: { __type: '[AIO_Grant]' },
        hasSpecimen: { __type: 'Boolean!' },
        hasSpecimenFiles: { __type: 'Boolean!' },
        highlightedWebResources: { __type: '[UrlResource]' },
        informationWebResource: { __type: 'UrlResource' },
        license: { __type: '[License]' },
        modality: { __type: '[Modality]' },
        priorityOrder: { __type: 'Int' },
        protocol: { __type: '[AIO_Protocol]' },
        publication: { __type: '[Publication]' },
        publisher: { __type: 'Publisher' },
        readMeFile: { __type: 'String' },
        referenceId: { __type: 'String!' },
        relatedProjects: { __type: '[DataCollectionProject]' },
        shortTitle: { __type: 'String!' },
        species: { __type: '[Species]' },
        specimenType: { __type: '[SpecimenType]' },
        subProgram: { __type: '[SubProgram]' },
        supersedes: { __type: '[String!]' },
        taxonomies: { __type: '[Taxonomy!]' },
        technique: { __type: '[Technique]' },
        title: { __type: 'String!' },
    },
    DataCollectionProjectInput: {
        citation: { __type: 'String' },
        contact: { __type: '[ContactInput]' },
        dataCollection: { __type: '[DataCollectionInput]' },
        dataContributor: { __type: '[DataContributorInput]' },
        dataCreator: { __type: '[DataCreatorInput]' },
        dataPublicationYear: { __type: '[String]' },
        description: { __type: 'String!' },
        doiSymbol: { __type: 'String' },
        grant: { __type: '[AIO_GrantInput]' },
        highlightedWebResources: { __type: '[UrlResourceInput]' },
        informationWebResource: { __type: 'UrlResourceInput' },
        license: { __type: '[LicenseInput]' },
        modality: { __type: '[ModalityInput]' },
        priorityOrder: { __type: 'Int' },
        protocol: { __type: '[AIO_ProtocolInput]' },
        publication: { __type: '[PublicationInput]' },
        publisher: { __type: 'PublisherInput' },
        readMeFile: { __type: 'String' },
        referenceId: { __type: 'String!' },
        relatedProjects: { __type: '[RelatedDataCollectionProjectInput]' },
        shortTitle: { __type: 'String!' },
        species: { __type: '[SpeciesInput]' },
        specimenType: { __type: '[SpecimenTypeInput]' },
        subProgram: { __type: '[SubProgramInput]' },
        taxonomies: { __type: '[TaxonomyInput!]' },
        technique: { __type: '[TechniqueInput]' },
        title: { __type: 'String!' },
    },
    DataContributor: {
        __typename: { __type: 'String!' },
        agentType: { __type: 'String!' },
        organization: { __type: 'Organization' },
        person: { __type: 'Person' },
        priorityOrder: { __type: 'Int' },
    },
    DataContributorInput: {
        agentType: { __type: 'String!' },
        organization: { __type: 'OrganizationInput' },
        person: { __type: 'PersonInput' },
        priorityOrder: { __type: 'Int' },
    },
    DataCreator: {
        __typename: { __type: 'String!' },
        agentType: { __type: 'String!' },
        organization: { __type: 'Organization' },
        person: { __type: 'Person' },
        priorityOrder: { __type: 'Int' },
    },
    DataCreatorInput: {
        agentType: { __type: 'String!' },
        organization: { __type: 'OrganizationInput' },
        person: { __type: 'PersonInput' },
        priorityOrder: { __type: 'Int' },
    },
    DataSet: {
        __typename: { __type: 'String!' },
        modality: { __type: '[Modality]' },
        name: { __type: 'String' },
        $on: { __type: '$DataSet!' },
    },
    DataType: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        dataSchema: { __type: 'JSON!' },
        description: { __type: 'String' },
        id: { __type: 'UUID!' },
        name: { __type: 'String!' },
        projects: { __type: '[ExternalReference!]!' },
        state: { __type: 'TypeState!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        version: { __type: 'Float!' },
    },
    DataTypeFilterInput: {
        and: { __type: '[DataTypeFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        dataSchema: { __type: 'JsonOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        name: { __type: 'StringOperationFilterInput' },
        or: { __type: '[DataTypeFilterInput!]' },
        projects: { __type: 'ListFilterInputTypeOfExternalReferenceFilterInput' },
        state: { __type: 'TypeStateOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        version: { __type: 'ComparableSingleOperationFilterInput' },
    },
    DatasetDisplayProperty: {
        __typename: { __type: 'String!' },
        defaultFilter: { __type: 'String' },
        defaultSort: { __type: 'String' },
        displayFeatures: { __type: '[FeatureDisplayProperty!]' },
        referenceId: { __type: 'String' },
        type: { __type: 'DisplayPropertyType' },
    },
    DatasetFilter: {
        dataCollectionReferenceId: { __type: 'String!' },
        datasetReferenceId: { __type: 'String!' },
        version: { __type: 'String!' },
    },
    DatasetFilterInput: {
        and: { __type: '[DatasetFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[DatasetFilterInput!]' },
        priorityOrder: { __type: 'ComparableInt32OperationFilterInput' },
        referenceId: { __type: 'StringOperationFilterInput' },
        shortTitle: { __type: 'StringOperationFilterInput' },
        title: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        version: { __type: 'StringOperationFilterInput' },
    },
    DatasetSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        description: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        priorityOrder: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        shortTitle: { __type: 'SortOrder' },
        title: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
        version: { __type: 'SortOrder' },
    },
    DefaultProjectInfo: {
        __typename: { __type: 'String!' },
        dataCollectionIdDefaults: { __type: '[ABCAtlasDefaultOptions]' },
        defaultProjectReferenceId: { __type: 'String!' },
    },
    DisplayProperty: {
        __typename: { __type: 'String!' },
        referenceId: { __type: 'String' },
        type: { __type: 'DisplayPropertyType' },
        $on: { __type: '$DisplayProperty!' },
    },
    DisplayPropertyFilter: {
        projectReferenceId: { __type: 'String' },
        type: { __type: 'DisplayPropertyType' },
        typeReferenceId: { __type: 'String' },
    },
    Donor: { __typename: { __type: 'String!' }, name: { __type: 'String' }, sex: { __type: 'String' } },
    DownloadFile: {
        __typename: { __type: 'String!' },
        displayName: { __type: 'String' },
        downloadUrl: { __type: 'String' },
    },
    DynamicGrid: {
        __typename: { __type: 'String!' },
        annotations: { __type: '[IAnnotation!]!' },
        bkpDataset: { __type: 'BkpDataset!' },
        color: { __type: '[IColorInfo!]!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        gridFeature: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        url: { __type: 'URL!' },
    },
    EntityInput: { entityType: { __type: 'EntityType!' }, identifyingAttribute: { __type: 'String!' } },
    EntityRelationshipInput: { sourceEntity: { __type: 'EntityInput!' }, targetEntity: { __type: 'EntityInput!' } },
    ExternalReference: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        id: { __type: 'UUID!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        uri: { __type: 'URL' },
        uuid: { __type: 'UUID' },
    },
    ExternalReferenceFilterInput: {
        and: { __type: '[ExternalReferenceFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[ExternalReferenceFilterInput!]' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        uri: { __type: 'UrlOperationFilterInput' },
        uuid: { __type: 'ComparableGuidOperationFilterInput' },
    },
    FeatureDisplayProperty: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
        $on: { __type: '$FeatureDisplayProperty!' },
    },
    FeatureDisplayPropertyInput: {
        featureType: { __type: 'FeatureTypeInput!' },
        isDefault: { __type: 'Boolean!' },
        priorityOrder: { __type: 'Int' },
    },
    FeatureMatrixAggregationResult: {
        __typename: { __type: 'String!' },
        groupByResults: { __type: '[FeatureMatrixGroupByResult]' },
        max: { __type: 'Float' },
        mean: { __type: 'Float' },
        min: { __type: 'Float' },
    },
    FeatureMatrixGroupByResult: {
        __typename: { __type: 'String!' },
        featureResults: { __type: '[FeatureResult]' },
        row: { __type: 'String' },
    },
    FeatureResult: { __typename: { __type: 'String!' }, feature: { __type: 'String' }, value: { __type: 'Float' } },
    FeatureType: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    FeatureTypeFilterInput: {
        and: { __type: '[FeatureTypeFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[FeatureTypeFilterInput!]' },
        referenceId: { __type: 'StringOperationFilterInput' },
        title: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    FeatureTypeInput: {
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    FeatureTypeSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        description: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        title: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
    },
    FeatureTypeValueIndex: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        index: { __type: 'Int!' },
        parentReferenceId: { __type: 'String' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        value: { __type: 'String!' },
    },
    FeatureTypeValueIndexFilterInput: {
        and: { __type: '[FeatureTypeValueIndexFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        featureType: { __type: 'FeatureTypeFilterInput' },
        featureTypeId: { __type: 'ComparableGuidOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        index: { __type: 'ComparableInt32OperationFilterInput' },
        or: { __type: '[FeatureTypeValueIndexFilterInput!]' },
        parentReferenceId: { __type: 'StringOperationFilterInput' },
        priorityOrder: { __type: 'ComparableInt32OperationFilterInput' },
        referenceId: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
        value: { __type: 'StringOperationFilterInput' },
    },
    FeatureTypeValueIndexSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        featureType: { __type: 'FeatureTypeSortInput' },
        featureTypeId: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        index: { __type: 'SortOrder' },
        parentReferenceId: { __type: 'SortOrder' },
        priorityOrder: { __type: 'SortOrder' },
        referenceId: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
        value: { __type: 'SortOrder' },
    },
    FileArchive: { __typename: { __type: 'String!' }, name: { __type: 'String!' }, referenceId: { __type: 'String!' } },
    FileArchiveInput: { name: { __type: 'String!' }, referenceId: { __type: 'String!' } },
    Filter: {
        field: { __type: 'field_String_pattern_id' },
        operator: { __type: 'FilterOperator' },
        value: { __type: 'String' },
    },
    FilterField: {
        __typename: { __type: 'String!' },
        alias: { __type: 'String' },
        displayName: { __type: 'String' },
        propertyName: { __type: 'String' },
    },
    Gene: {
        __typename: { __type: 'String!' },
        entrezId: { __type: 'String' },
        genome: { __type: 'String' },
        symbol: { __type: 'String' },
    },
    Genotype: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    Hemisphere: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    HttpStatusCodeResponse: {
        __typename: { __type: 'String!' },
        code: { __type: 'Int' },
        status: { __type: 'String' },
    },
    IAnnotation: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$IAnnotation!' },
    },
    IColorInfo: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        id: { __type: 'UUID!' },
        type: { __type: 'ColorType!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$IColorInfo!' },
    },
    IDataset: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        version: { __type: 'String!' },
        $on: { __type: '$IDataset!' },
    },
    IGene: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        genome: { __type: 'String!' },
        id: { __type: 'UUID!' },
        referenceId: { __type: 'String!' },
        symbol: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$IGene!' },
    },
    INumericColor: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        id: { __type: 'UUID!' },
        maxClamp: { __type: 'Float!' },
        minClamp: { __type: 'Float!' },
        nullColor: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$INumericColor!' },
    },
    IProperty: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$IProperty!' },
    },
    IVisualization: {
        __typename: { __type: 'String!' },
        annotations: { __type: '[IAnnotation!]!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        $on: { __type: '$IVisualization!' },
    },
    Image: {
        __typename: { __type: 'String!' },
        annotated: { __type: 'Boolean' },
        bytes: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        height: { __type: 'Int!' },
        modality: { __type: '[Modality!]' },
        referenceId: { __type: 'String!' },
        url: { __type: 'String!' },
        width: { __type: 'Int!' },
    },
    ImageDimensions: { __typename: { __type: 'String!' }, height: { __type: 'Int!' }, width: { __type: 'Int!' } },
    ImageDisplayProperty: {
        __typename: { __type: 'String!' },
        dimensions: { __type: 'ImageDimensions' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
    },
    ImageInput: {
        annotated: { __type: 'Boolean' },
        bytes: { __type: 'String!' },
        featureType: { __type: 'FeatureTypeInput!' },
        modality: { __type: '[ModalityInput!]' },
        referenceId: { __type: 'String!' },
    },
    InitializeDownloadResponse: { __typename: { __type: 'String!' }, signedUrl: { __type: 'String' } },
    InitializeUploadResponse: {
        __typename: { __type: 'String!' },
        executionID: { __type: 'String' },
        signedUrl: { __type: 'String' },
    },
    IntDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: 'Int' },
    },
    ItemCount: { __typename: { __type: 'String!' }, count: { __type: 'Int' }, name: { __type: 'String' } },
    JsonOperationFilterInput: {
        and: { __type: '[JsonOperationFilterInput!]' },
        containedBy: { __type: 'JSON' },
        contains: { __type: 'JSON' },
        containsAllKeys: { __type: '[String!]' },
        containsAnyKeys: { __type: '[String!]' },
        containsKey: { __type: 'String' },
        or: { __type: '[JsonOperationFilterInput!]' },
    },
    License: {
        __typename: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        urlResource: { __type: 'UrlResource' },
    },
    LicenseInput: {
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        urlResource: { __type: 'UrlResourceInput' },
    },
    ListExtendedStringOperationFilterInput: {
        all: { __type: 'StringOperationFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'StringOperationFilterInput' },
        some: { __type: 'StringOperationFilterInput' },
    },
    ListFilterInputTypeOfAnnotationFilterInput: {
        all: { __type: 'AnnotationFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'AnnotationFilterInput' },
        some: { __type: 'AnnotationFilterInput' },
    },
    ListFilterInputTypeOfCellPropertyFilterInput: {
        all: { __type: 'CellPropertyFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'CellPropertyFilterInput' },
        some: { __type: 'CellPropertyFilterInput' },
    },
    ListFilterInputTypeOfExternalReferenceFilterInput: {
        all: { __type: 'ExternalReferenceFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'ExternalReferenceFilterInput' },
        some: { __type: 'ExternalReferenceFilterInput' },
    },
    ListFilterInputTypeOfMetadataFilterInput: {
        all: { __type: 'MetadataFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'MetadataFilterInput' },
        some: { __type: 'MetadataFilterInput' },
    },
    ListFilterInputTypeOfVisualizationFilterInput: {
        all: { __type: 'VisualizationFilterInput' },
        any: { __type: 'Boolean' },
        none: { __type: 'VisualizationFilterInput' },
        some: { __type: 'VisualizationFilterInput' },
    },
    MappingResult: {
        __typename: { __type: 'String!' },
        ETA: { __type: 'String' },
        algorithm: { __type: 'String' },
        algorithmStatus: { __type: 'String' },
        endTime: { __type: 'String' },
        executionID: { __type: 'String' },
        fileName: { __type: 'String' },
        fileSize: { __type: 'String' },
        mappedCellsCount: { __type: 'String' },
        mappedGenesCount: { __type: 'String' },
        reference: { __type: 'String' },
        referenceDataDisplayName: { __type: 'String' },
        startTime: { __type: 'String' },
        workflowDisplayName: { __type: 'String' },
        workflowStatus: { __type: 'String' },
    },
    Measurement: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        measurementType: { __type: 'MeasurementType!' },
        modality: { __type: '[Modality!]' },
        referenceId: { __type: 'String!' },
        unit: { __type: 'String' },
        value: { __type: 'String' },
    },
    MeasurementDisplayProperty: {
        __typename: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        measurementStats: { __type: 'MeasurementStats' },
        measurementType: { __type: 'MeasurementType' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
        unit: { __type: 'String' },
    },
    MeasurementInput: {
        featureType: { __type: 'FeatureTypeInput!' },
        measurementType: { __type: 'MeasurementType!' },
        modality: { __type: '[ModalityInput!]' },
        referenceId: { __type: 'String!' },
        unit: { __type: 'String' },
        value: { __type: 'String' },
    },
    MeasurementStats: {
        __typename: { __type: 'String!' },
        avg: { __type: 'Float' },
        max: { __type: 'Float' },
        min: { __type: 'Float' },
        std: { __type: 'Float' },
    },
    Metadata: {
        __typename: { __type: 'String!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        data: { __type: 'JSON!' },
        id: { __type: 'UUID!' },
        type: { __type: 'DataType!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    MetadataFilterInput: {
        and: { __type: '[MetadataFilterInput!]' },
        bkpDataset: { __type: 'BkpDatasetFilterInput' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        data: { __type: 'JsonOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[MetadataFilterInput!]' },
        type: { __type: 'DataTypeFilterInput' },
        typeId: { __type: 'ComparableGuidOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    Modality: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    ModalityInput: { name: { __type: 'String!' } },
    NumericColorFilterInput: {
        and: { __type: '[NumericColorFilterInput!]' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        maxClamp: { __type: 'ComparableSingleOperationFilterInput' },
        minClamp: { __type: 'ComparableSingleOperationFilterInput' },
        nullColor: { __type: 'StringOperationFilterInput' },
        numericPropertyId: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[NumericColorFilterInput!]' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    NumericColorInputDistinguisherFilterInput: {
        and: { __type: '[NumericColorInputDistinguisherFilterInput!]' },
        colorGradient: { __type: 'ColorGradientFilterInput' },
        colorMap: { __type: 'ColorMapFilterInput' },
        or: { __type: '[NumericColorInputDistinguisherFilterInput!]' },
    },
    NumericColorInputDistinguisherSortInput: {
        colorGradient: { __type: 'ColorGradientSortInput' },
        colorMap: { __type: 'ColorMapSortInput' },
    },
    NumericColorSortInput: {
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        maxClamp: { __type: 'SortOrder' },
        minClamp: { __type: 'SortOrder' },
        nullColor: { __type: 'SortOrder' },
        numericPropertyId: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
    },
    NumericDisplayProperty: {
        __typename: { __type: 'String!' },
        defaultFilterMax: { __type: 'Float' },
        defaultFilterMin: { __type: 'Float' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        includeZeros: { __type: 'Boolean!' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        nullColoring: { __type: 'NullDisplayOption!' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
    },
    NumericPropertiesConnection: {
        __typename: { __type: 'String!' },
        edges: { __type: '[NumericPropertiesEdge!]' },
        nodes: { __type: '[NumericProperty!]' },
        pageInfo: { __type: 'PageInfo!' },
        totalCount: { __type: 'Int!' },
    },
    NumericPropertiesEdge: {
        __typename: { __type: 'String!' },
        cursor: { __type: 'String!' },
        node: { __type: 'NumericProperty!' },
    },
    NumericProperty: {
        __typename: { __type: 'String!' },
        avg: { __type: 'Float!' },
        color: { __type: 'INumericColor!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        dataset: { __type: 'IDataset!' },
        featureType: { __type: 'FeatureType!' },
        id: { __type: 'UUID!' },
        max: { __type: 'Float!' },
        min: { __type: 'Float!' },
        std: { __type: 'Float!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    NumericPropertyFilterInput: {
        and: { __type: '[NumericPropertyFilterInput!]' },
        avg: { __type: 'ComparableSingleOperationFilterInput' },
        color: { __type: 'NumericColorFilterInput' },
        colorInput: { __type: 'NumericColorInputDistinguisherFilterInput' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        dataset: { __type: 'DatasetFilterInput' },
        datasetId: { __type: 'ComparableGuidOperationFilterInput' },
        featureType: { __type: 'FeatureTypeFilterInput' },
        featureTypeId: { __type: 'ComparableGuidOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        max: { __type: 'ComparableSingleOperationFilterInput' },
        min: { __type: 'ComparableSingleOperationFilterInput' },
        or: { __type: '[NumericPropertyFilterInput!]' },
        std: { __type: 'ComparableSingleOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    NumericPropertySortInput: {
        avg: { __type: 'SortOrder' },
        color: { __type: 'NumericColorSortInput' },
        colorInput: { __type: 'NumericColorInputDistinguisherSortInput' },
        createdAt: { __type: 'SortOrder' },
        createdBy: { __type: 'SortOrder' },
        dataset: { __type: 'DatasetSortInput' },
        datasetId: { __type: 'SortOrder' },
        featureType: { __type: 'FeatureTypeSortInput' },
        featureTypeId: { __type: 'SortOrder' },
        id: { __type: 'SortOrder' },
        max: { __type: 'SortOrder' },
        min: { __type: 'SortOrder' },
        std: { __type: 'SortOrder' },
        updatedAt: { __type: 'SortOrder' },
        updatedBy: { __type: 'SortOrder' },
    },
    Organization: {
        __typename: { __type: 'String!' },
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        rorSymbol: { __type: 'String' },
    },
    OrganizationInput: {
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        rorSymbol: { __type: 'String' },
    },
    PageInfo: {
        __typename: { __type: 'String!' },
        endCursor: { __type: 'String' },
        hasNextPage: { __type: 'Boolean!' },
        hasPreviousPage: { __type: 'Boolean!' },
        startCursor: { __type: 'String' },
    },
    PathologyImage: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        donorReferenceId: { __type: 'String!' },
        featureType: { __type: 'FeatureType!' },
        region: { __type: 'String!' },
        slide: { __type: 'String!' },
        tileSource: { __type: 'TileSource' },
    },
    PathologyImageMetadata: {
        __typename: { __type: 'String!' },
        region: { __type: 'String!' },
        slides: { __type: '[String!]!' },
    },
    PathologyImageProperties: {
        __typename: { __type: 'String!' },
        donorReferenceId: { __type: 'String!' },
        properties: { __type: '[PathologyImageMetadata!]!' },
    },
    Person: {
        __typename: { __type: 'String!' },
        ORCID: { __type: 'String' },
        familyName: { __type: 'String!' },
        givenName: { __type: 'String!' },
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
    },
    PersonInput: {
        ORCID: { __type: 'String' },
        familyName: { __type: 'String!' },
        givenName: { __type: 'String!' },
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
    },
    Program: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        informationWebResource: { __type: 'UrlResource' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    ProgramDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[BffProgram!]!' },
    },
    ProgramInput: {
        description: { __type: 'String!' },
        informationWebResource: { __type: 'UrlResourceInput' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    ProjectDisplayArrayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[BffProject!]!' },
    },
    ProjectDisplayProperty: {
        __typename: { __type: 'String!' },
        defaultFilter: { __type: 'String' },
        defaultSort: { __type: 'String' },
        displayFeatures: { __type: '[FeatureDisplayProperty!]' },
        referenceId: { __type: 'String' },
        type: { __type: 'DisplayPropertyType' },
    },
    ProjectDisplayPropertyInput: {
        defaultFilter: { __type: '[Filter!]' },
        defaultSort: { __type: '[Sort!]' },
        displayFeatures: { __type: '[FeatureDisplayPropertyInput!]!' },
        projectReferenceId: { __type: 'String' },
    },
    PropertyDisplayNameMetadata: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        longName: { __type: 'String!' },
        shortName: { __type: 'String!' },
    },
    PropertyValueTuple: {
        __typename: { __type: 'String!' },
        property: { __type: 'String' },
        value: { __type: 'String' },
    },
    Publication: {
        __typename: { __type: 'String!' },
        author: { __type: 'Person!' },
        doiSymbol: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        publicationYear: { __type: 'String!' },
        pubmedId: { __type: 'String' },
        referenceId: { __type: 'String!' },
        title: { __type: 'String' },
    },
    PublicationDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[BffPublication!]!' },
    },
    PublicationInput: {
        author: { __type: 'PersonInput!' },
        doiSymbol: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        publicationYear: { __type: 'String!' },
        pubmedId: { __type: 'String' },
        referenceId: { __type: 'String!' },
        title: { __type: 'String' },
    },
    Publisher: { __typename: { __type: 'String!' }, organization: { __type: 'Organization!' } },
    PublisherInput: { organization: { __type: 'OrganizationInput!' } },
    RangeGroupBy: { field: { __type: 'field_String_pattern_id' }, range: { __type: '[String]' } },
    RangeGroupByInput: { field: { __type: 'String!' }, range: { __type: '[String]!' } },
    Region: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    RelatedDataCollectionProjectInput: { priorityOrder: { __type: 'Int' }, referenceId: { __type: 'String!' } },
    RelatedSpecimen: {
        __typename: { __type: 'String!' },
        relationship: { __type: 'SpecimenRelationship!' },
        specimenReferenceIds: { __type: '[String!]!' },
    },
    RelatedSpecimenInput: {
        relationship: { __type: 'SpecimenRelationshipInputType!' },
        specimenReferenceIds: { __type: '[String!]!' },
    },
    Sort: { field: { __type: 'field_String_pattern_id' }, order: { __type: 'SortOrder' } },
    Species: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    SpeciesInput: { name: { __type: 'String!' } },
    Specimen: {
        __typename: { __type: 'String!' },
        broadClass: { __type: 'BroadClass' },
        cluster: { __type: 'Cluster' },
        corticalLayer: { __type: '[CorticalLayer]' },
        dataSet: { __type: 'String' },
        donor: { __type: 'Donor' },
        genotype: { __type: 'Genotype' },
        hemisphere: { __type: 'Hemisphere' },
        name: { __type: 'String' },
        region: { __type: '[Region]' },
        specimenType: { __type: 'String' },
        subclass: { __type: 'Subclass' },
        subspecimenCount: { __type: 'Int' },
        subspecimenType: { __type: 'String' },
    },
    SpecimenCount: {
        __typename: { __type: 'String!' },
        specimenCount: { __type: 'Int' },
        specimenType: { __type: 'SpecimenType!' },
    },
    SpecimenCountInput: { specimenCount: { __type: 'Int' }, specimenType: { __type: 'SpecimenTypeInput!' } },
    SpecimenExportResult: {
        __typename: { __type: 'String!' },
        errorMessage: { __type: 'String' },
        status: { __type: 'ExportStatus!' },
        url: { __type: 'String' },
    },
    SpecimenFile: {
        __typename: { __type: 'String!' },
        archive: { __type: 'FileArchive' },
        checksum: { __type: 'String' },
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        type: { __type: 'String!' },
        uri: { __type: 'String!' },
    },
    SpecimenFileInput: {
        archive: { __type: 'FileArchiveInput' },
        checksum: { __type: 'String' },
        name: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        type: { __type: 'String!' },
        uri: { __type: 'String!' },
    },
    SpecimenType: {
        __typename: { __type: 'String!' },
        name: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String' },
    },
    SpecimenTypeDisplayProperty: {
        __typename: { __type: 'String!' },
        defaultFilter: { __type: 'String' },
        defaultSort: { __type: 'String' },
        displayFeatures: { __type: '[FeatureDisplayProperty!]' },
        projectReferenceId: { __type: 'String' },
        referenceId: { __type: 'String' },
        type: { __type: 'DisplayPropertyType' },
    },
    SpecimenTypeDisplayPropertyInput: {
        defaultFilter: { __type: '[Filter!]' },
        defaultSort: { __type: '[Sort!]' },
        displayFeatures: { __type: '[FeatureDisplayPropertyInput!]!' },
        projectReferenceId: { __type: 'String!' },
        specimenTypeReferenceId: { __type: 'String!' },
    },
    SpecimenTypeInput: {
        name: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String' },
    },
    SpecimenViewDefaultOptions: {
        __typename: { __type: 'String!' },
        filterFeatures: { __type: '[String!]!' },
        filterState: { __type: '[BffFilterType!]!' },
        listImageFeatures: { __type: '[String!]!' },
        sortState: { __type: '[BffSortType!]!' },
        summaryFeatures: { __type: '[String!]!' },
        tableColumnFeatures: { __type: '[String!]!' },
    },
    StringArrayDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[String]' },
    },
    StringDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: 'String' },
    },
    StringOperationFilterInput: {
        and: { __type: '[StringOperationFilterInput!]' },
        contains: { __type: 'String' },
        containsInsensitive: { __type: 'String' },
        endsWith: { __type: 'String' },
        endsWithInsensitive: { __type: 'String' },
        eq: { __type: 'String' },
        eqInsensitive: { __type: 'String' },
        in: { __type: '[String]' },
        ncontains: { __type: 'String' },
        nendsWith: { __type: 'String' },
        neq: { __type: 'String' },
        nin: { __type: '[String]' },
        nstartsWith: { __type: 'String' },
        or: { __type: '[StringOperationFilterInput!]' },
        startsWith: { __type: 'String' },
        startsWithInsensitive: { __type: 'String' },
    },
    SubProgram: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        informationWebResource: { __type: 'UrlResource' },
        priorityOrder: { __type: 'Int' },
        program: { __type: 'Program' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    SubProgramInput: {
        description: { __type: 'String!' },
        informationWebResource: { __type: 'UrlResourceInput' },
        priorityOrder: { __type: 'Int' },
        program: { __type: 'ProgramInput' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    Subclass: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    SvgAnnotation: {
        __typename: { __type: 'String!' },
        annotationFeatures: { __type: '[AnnotationFeature!]!' },
        annotationType: { __type: 'AnnotationType!' },
        baseUrl: { __type: 'URL!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
    },
    SvgAnnotationInput: {
        annotationType: { __type: 'AnnotationType!' },
        baseUrl: { __type: 'URL!' },
        description: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
    },
    Taxon: {
        __typename: { __type: 'String!' },
        cRID: { __type: 'CRID!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        symbol: { __type: 'String!' },
    },
    TaxonInput: {
        cRID: { __type: 'CRIDInput!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        symbol: { __type: 'String!' },
    },
    Taxonomy: {
        __typename: { __type: 'String!' },
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        taxonomyNodes: { __type: '[TaxonomyNode!]' },
        title: { __type: 'String!' },
        type: { __type: 'TaxonomyType!' },
    },
    TaxonomyInput: {
        description: { __type: 'String!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        taxonomyNodes: { __type: '[TaxonomyNodeInput!]' },
        title: { __type: 'String!' },
        type: { __type: 'TaxonomyType!' },
    },
    TaxonomyNode: {
        __typename: { __type: 'String!' },
        childrenReferenceIds: { __type: '[String!]' },
        color: { __type: 'String' },
        description: { __type: 'String!' },
        featureTypeReferenceId: { __type: 'String' },
        parentReferenceId: { __type: 'String' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        taxon: { __type: 'Taxon!' },
        title: { __type: 'String!' },
    },
    TaxonomyNodeInput: {
        childrenReferenceIds: { __type: '[String!]' },
        color: { __type: 'String' },
        description: { __type: 'String!' },
        featureTypeReferenceId: { __type: 'String' },
        parentReferenceId: { __type: 'String' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        taxon: { __type: 'TaxonInput!' },
        title: { __type: 'String!' },
    },
    TaxonomySpecies: {
        __typename: { __type: 'String!' },
        species: { __type: 'String!' },
        taxonomyId: { __type: 'String!' },
    },
    Technique: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    TechniqueInput: { name: { __type: 'String!' } },
    TileSource: {
        __typename: { __type: 'String!' },
        annotationSvg: { __type: 'String' },
        metadataUrl: { __type: 'String!' },
        url: { __type: 'String!' },
    },
    TranscriptomicDataSet: {
        __typename: { __type: 'String!' },
        cellTypeTaxonomy: { __type: '[CellTypeTaxonomy]' },
        defaultCentralMeasure: { __type: 'String' },
        displayName: { __type: 'String' },
        downloadFiles: { __type: '[DownloadFile]' },
        downloadPage: { __type: 'String' },
        features: { __type: '[Gene]' },
        markers: { __type: '[Gene]' },
        modality: { __type: '[Modality]' },
        name: { __type: 'String' },
        protocolsUrl: { __type: 'String' },
        tSNEPlots: { __type: '[tSNEPlotInfo]' },
    },
    TreeDisplayProperty: {
        __typename: { __type: 'String!' },
        featureSet: { __type: '[CategoricalDisplayProperty]' },
        featureType: { __type: 'FeatureType!' },
        filterOperator: { __type: 'FilterOperator' },
        isDefault: { __type: 'Boolean!' },
        modality: { __type: '[Modality!]' },
        priorityOrder: { __type: 'Int' },
        type: { __type: 'FeatureDisplayType' },
    },
    TriggerBkpWorkflowResponse: {
        __typename: { __type: 'String!' },
        JobStatus: { __type: 'String' },
        result: { __type: 'String' },
    },
    TypeStateOperationFilterInput: {
        eq: { __type: 'TypeState' },
        in: { __type: '[TypeState!]' },
        neq: { __type: 'TypeState' },
        nin: { __type: '[TypeState!]' },
    },
    Umap: {
        __typename: { __type: 'String!' },
        annotations: { __type: '[IAnnotation!]!' },
        color: { __type: '[IColorInfo!]!' },
        createdAt: { __type: 'DateTime!' },
        createdBy: { __type: 'String!' },
        description: { __type: 'String!' },
        id: { __type: 'UUID!' },
        priorityOrder: { __type: 'Int!' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        updatedAt: { __type: 'DateTime' },
        updatedBy: { __type: 'String' },
        url: { __type: 'URL!' },
    },
    UrlOperationFilterInput: {
        eq: { __type: 'URL' },
        gt: { __type: 'URL' },
        gte: { __type: 'URL' },
        in: { __type: '[URL]' },
        lt: { __type: 'URL' },
        lte: { __type: 'URL' },
        neq: { __type: 'URL' },
        ngt: { __type: 'URL' },
        ngte: { __type: 'URL' },
        nin: { __type: '[URL]' },
        nlt: { __type: 'URL' },
        nlte: { __type: 'URL' },
    },
    UrlResource: {
        __typename: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        type: { __type: 'String!' },
        url: { __type: 'String!' },
    },
    UrlResourceInput: {
        priorityOrder: { __type: 'Int' },
        referenceId: { __type: 'String!' },
        shortTitle: { __type: 'String!' },
        title: { __type: 'String!' },
        type: { __type: 'String!' },
        url: { __type: 'String!' },
    },
    UserQuotaResponse: { __typename: { __type: 'String!' }, userQuota: { __type: 'Float' } },
    VisualizationFilterInput: {
        and: { __type: '[VisualizationFilterInput!]' },
        annotations: { __type: 'ListFilterInputTypeOfAnnotationFilterInput' },
        bkpDataset: { __type: 'BkpDatasetFilterInput' },
        createdAt: { __type: 'ComparableDateTimeOperationFilterInput' },
        createdBy: { __type: 'StringOperationFilterInput' },
        description: { __type: 'StringOperationFilterInput' },
        id: { __type: 'ComparableGuidOperationFilterInput' },
        or: { __type: '[VisualizationFilterInput!]' },
        priorityOrder: { __type: 'ComparableNullableOfInt32OperationFilterInput' },
        referenceId: { __type: 'StringOperationFilterInput' },
        shortTitle: { __type: 'StringOperationFilterInput' },
        title: { __type: 'StringOperationFilterInput' },
        updatedAt: { __type: 'ComparableNullableOfDateTimeOperationFilterInput' },
        updatedBy: { __type: 'StringOperationFilterInput' },
    },
    WebResourceLink: {
        __typename: { __type: 'String!' },
        iconKey: { __type: 'String' },
        text: { __type: 'String' },
        url: { __type: 'String' },
    },
    WebResourceLinkArrayDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: '[WebResourceLink]' },
    },
    WebResourceLinkDisplayProperty: {
        __typename: { __type: 'String!' },
        metadata: { __type: 'PropertyDisplayNameMetadata' },
        value: { __type: 'WebResourceLink' },
    },
    WorkflowExecutionStatusResponse: {
        __typename: { __type: 'String!' },
        ETA: { __type: 'String' },
        algorithmStatus: { __type: 'String' },
        workflowStatus: { __type: 'String' },
    },
    WorkflowNames: {
        __typename: { __type: 'String!' },
        isAlgorithmDefaultForRefData: { __type: 'Boolean' },
        reference: { __type: 'String' },
        referenceDataDisplayName: { __type: 'String' },
        workflowDisplayName: { __type: 'String' },
        workflowName: { __type: 'String' },
    },
    mutation: {
        __typename: { __type: 'String!' },
        _empty: { __type: 'String' },
        cancelWorkflow: { __type: 'HttpStatusCodeResponse', __args: { executionID: 'String!' } },
        cancelWorkflowAnonymous: {
            __type: 'HttpStatusCodeResponse',
            __args: { executionID: 'String!', uuid: 'String!' },
        },
        deleteDataCollectionProject: {
            __type: 'Boolean',
            __args: { referenceId: 'String!', supersededBy: '[String!]' },
        },
        deleteMappingResult: { __type: 'HttpStatusCodeResponse', __args: { executionID: 'String!' } },
        removeEntityRelationship: { __type: 'Boolean', __args: { input: '[EntityRelationshipInput!]!' } },
        restoreToLKG: { __type: 'Boolean' },
        updateDataCollectionProjectInventory: {
            __type: '[DataCollectionProject]',
            __args: { input: '[DataCollectionProjectInput]' },
        },
        updateProjectDisplayProperty: {
            __type: 'ProjectDisplayProperty',
            __args: { input: 'ProjectDisplayPropertyInput' },
        },
        updateSpecimenTypeDisplayProperty: {
            __type: 'SpecimenTypeDisplayProperty',
            __args: { input: 'SpecimenTypeDisplayPropertyInput!' },
        },
        updateSpecimens: {
            __type: '[AIO_Specimen]',
            __args: { input: '[AIO_SpecimenInput]', refreshViews: 'Boolean' },
        },
    },
    priorityOrderedObject: {
        __typename: { __type: 'String!' },
        priorityOrder: { __type: 'Int' },
        $on: { __type: '$priorityOrderedObject!' },
    },
    query: {
        __typename: { __type: 'String!' },
        _empty: { __type: 'String' },
        aggregateRowsOnFeatureMatrix: {
            __type: 'FeatureMatrixAggregationResult',
            __args: {
                dataset: 'String',
                features: '[String]',
                groupBy: 'MatrixAggregationCellMetadata',
                operator: 'MatrixAggregationOperator',
                rows: '[String]',
            },
        },
        aio_specimen: {
            __type: '[AIO_Specimen]',
            __args: { filter: '[Filter]', limit: 'Int', offset: 'Int', sort: '[Sort]' },
        },
        aio_specimenCounts: {
            __type: '[AggregationResult]',
            __args: { filter: '[Filter]', groupBy: '[groupBy_List_String_pattern_id]', sort: '[Sort]' },
        },
        aio_specimenFacetedSearchProperties: {
            __type: '[AIO_SpecimenFacetedSearchProperty]',
            __args: { filter: '[Filter]' },
        },
        aio_specimenRangeCounts: {
            __type: '[AggregationResult]',
            __args: { filter: '[Filter]', groupBy: 'RangeGroupBy' },
        },
        allRowsForFeature: { __type: 'JSON', __args: { dataset: 'String', feature: 'String' } },
        askGPT: { __type: 'String!', __args: { prompt: 'String!' } },
        autosuggestCellTypes: { __type: 'JSON', __args: { limit: 'Int', q: 'String!', species: '[String!]' } },
        bkpDatasets: {
            __type: 'BkpDatasetsConnection',
            __args: {
                after: 'String',
                before: 'String',
                first: 'Int',
                last: 'Int',
                order: '[BkpDatasetSortInput!]',
                where: 'BkpDatasetFilterInput',
            },
        },
        cellCounts: {
            __type: '[AggregationResult!]',
            __args: {
                datasetFilter: 'DatasetFilter',
                filter: '[CellFilterInput!]',
                filters: '[[CellFilterInput!]]',
                groupBy: '[String!]',
            },
        },
        cellGenes: {
            __type: 'CellGenesConnection',
            __args: {
                after: 'String',
                before: 'String',
                first: 'Int',
                last: 'Int',
                order: '[CellGeneSortInput!]',
                where: 'CellGeneFilterInput',
            },
        },
        cellInfo: {
            __type: '[CellInfo!]',
            __args: {
                datasetFilter: 'DatasetFilter',
                filter: '[CellFilterInput!]',
                filters: '[[CellFilterInput!]]',
                limit: 'Int',
                prevPageMaxIndex: 'Int',
                properties: '[String!]',
            },
        },
        cellProperties: {
            __type: 'CellPropertiesConnection',
            __args: {
                after: 'String',
                before: 'String',
                first: 'Int',
                last: 'Int',
                order: '[CellPropertySortInput!]',
                where: 'CellPropertyFilterInput',
            },
        },
        cellRangeCounts: {
            __type: '[AggregationResult]',
            __args: {
                datasetFilter: 'DatasetFilter',
                filter: '[CellFilterInput!]',
                filters: '[[CellFilterInput!]]',
                groupBy: 'RangeGroupByInput!',
            },
        },
        dataCollectionProjectFacetedSearchProperties: { __type: '[String]' },
        dataCollectionProjectInventory: {
            __type: '[DataCollectionProject]',
            __args: { filter: '[Filter]', limit: 'Int', offset: 'Int', sort: '[Sort]' },
        },
        dataCollectionProjectInventoryCounts: {
            __type: '[AggregationResult]',
            __args: { filter: '[Filter]', groupBy: '[groupBy_List_String_pattern_id]' },
        },
        exportSpecimen: {
            __type: 'SpecimenExportResult',
            __args: {
                bundleType: 'SpecimenBundleType!',
                columns: '[String]',
                filters: '[Filter]',
                projectReferenceId: 'String!',
            },
        },
        getABCAtlasDefaults: { __type: 'DefaultProjectInfo', __args: { dataCollectionIds: '[String]' } },
        getAnonymousUuid: { __type: 'String!' },
        getAvailableTaxonomies: { __type: '[TaxonomySpecies]!' },
        getCellTypesTaxonomyInfo: { __type: 'CellTypeTaxonomyInfo', __args: { taxonomyId: 'String' } },
        getDataCollectionProjectDisplay: {
            __type: '[DataCollectionDisplayProject]!',
            __args: { filter: '[BffFilter]', limit: 'Int', offset: 'Int', sort: '[BffSort]' },
        },
        getDisplayProperty: { __type: 'DisplayProperty', __args: { displayPropertyFilter: 'DisplayPropertyFilter!' } },
        getDonorPathologyImageProperties: {
            __type: 'PathologyImageProperties',
            __args: { donorReferenceId: 'String!' },
        },
        getDonorPathologyImageSet: {
            __type: '[PathologyImage!]',
            __args: { donorReferenceId: 'String!', region: 'String!', slide: 'String!' },
        },
        getFeaturesInDataSet: { __type: '[Gene]', __args: { DataSet: 'String!', features: '[String]!', limit: 'Int' } },
        getFilterField: { __type: '[FilterField]' },
        getItemCount: { __type: '[ItemCount]', __args: { filter: '[BffFilter]', groupBy: 'String', sort: 'BffSort' } },
        getMappingResults: { __type: '[MappingResult]' },
        getProjectCVImageProperties: { __type: 'CVProperties', __args: { projectReferenceId: 'String!' } },
        getProjectCVImageSet: { __type: '[CVImage]', __args: { input: 'CVImagePropertyInput' } },
        getSpecimenViewDefaultOptions: { __type: 'SpecimenViewDefaultOptions', __args: { filter: '[BffFilter!]!' } },
        getTSNEData: { __type: 'ByteArray', __args: { TSNEName: 'String' } },
        getTranscriptomicDataSet: { __type: 'TranscriptomicDataSet', __args: { DataSet: 'String' } },
        getUserQuota: { __type: 'UserQuotaResponse' },
        getWorkflowNames: { __type: '[WorkflowNames]' },
        getWorkflowStatus: { __type: 'WorkflowExecutionStatusResponse', __args: { executionID: 'String!' } },
        getWorkflowStatusAnonymous: {
            __type: 'WorkflowExecutionStatusResponse',
            __args: { executionID: 'String!', uuid: 'String!' },
        },
        initializeDownload: { __type: 'InitializeDownloadResponse', __args: { executionID: 'String!' } },
        initializeDownloadAnonymous: {
            __type: 'InitializeDownloadResponse',
            __args: { executionID: 'String!', uuid: 'String!' },
        },
        initializeUpload: { __type: 'InitializeUploadResponse', __args: { fileName: 'String!', fileSize: 'String!' } },
        initializeUploadAnonymous: {
            __type: 'InitializeUploadResponse',
            __args: { fileName: 'String!', fileSize: 'String!', uuid: 'String!' },
        },
        listTranscriptomicDataSets: { __type: '[TranscriptomicDataSet]' },
        numericProperties: {
            __type: 'NumericPropertiesConnection',
            __args: {
                after: 'String',
                before: 'String',
                first: 'Int',
                last: 'Int',
                order: '[NumericPropertySortInput!]',
                where: 'NumericPropertyFilterInput',
            },
        },
        searchCellTypes: { __type: 'JSON', __args: { limit: 'Int', q: 'String!', species: '[String!]' } },
        searchFeaturesInDataSet: {
            __type: '[Gene]',
            __args: { DataSet: 'String!', exact: 'Boolean', limit: 'Int', sort: '[Sort]', text: 'String!' },
        },
        specimen: { __type: '[Specimen]', __args: { filter: '[Filter]', limit: 'Int', offset: 'Int', sort: '[Sort]' } },
        specimenAggregate: {
            __type: '[AggregationResult]',
            __args: {
                aggregationOperation: 'AggregationOperation',
                filter: '[Filter]',
                groupBy: '[groupBy_List_String_pattern_id]',
                sort: '[Sort]',
            },
        },
        specimenFacetedSearchProperties: { __type: '[String]' },
        triggerBkpWorkflow: {
            __type: 'TriggerBkpWorkflowResponse',
            __args: { executionID: 'String!', referenceTaxonomies: '[String]!', workflowNames: '[String]!' },
        },
        triggerBkpWorkflowAnonymous: {
            __type: 'TriggerBkpWorkflowResponse',
            __args: {
                email: 'String',
                executionID: 'String!',
                referenceTaxonomies: '[String]!',
                uuid: 'String!',
                workflowNames: '[String]!',
            },
        },
    },
    subscription: {},
    tSNEPlotInfo: { __typename: { __type: 'String!' }, name: { __type: 'String' } },
    [SchemaUnionsKey]: {
        priorityOrderedObject: [
            'AIO_Grant',
            'AIO_Protocol',
            'Contact',
            'DataCollection',
            'DataCollectionProject',
            'DataContributor',
            'DataCreator',
            'License',
            'Program',
            'Publication',
            'SpecimenType',
            'SubProgram',
            'UrlResource',
        ],
        FeatureDisplayProperty: [
            'AnnotationDisplayProperty',
            'CategoricalDisplayProperty',
            'ImageDisplayProperty',
            'MeasurementDisplayProperty',
            'NumericDisplayProperty',
            'TreeDisplayProperty',
        ],
        IDataset: ['BkpDataset'],
        IGene: ['CellGene'],
        IProperty: ['CellProperty'],
        INumericColor: ['ColorGradient', 'ColorMap'],
        IColorInfo: ['ColorSetInfo'],
        IVisualization: ['CoronalGrid', 'DynamicGrid', 'Umap'],
        AIO_Project: ['DataCollectionProject', 'Program', 'SubProgram'],
        DisplayProperty: ['DatasetDisplayProperty', 'ProjectDisplayProperty', 'SpecimenTypeDisplayProperty'],
        IAnnotation: ['SvgAnnotation'],
        DataSet: ['TranscriptomicDataSet'],
    },
} as const;

export interface ABCAtlasDefaultOptions {
    __typename?: 'ABCAtlasDefaultOptions';
    dataCollectionId?: Maybe<ScalarsEnums['String']>;
    /**
     * Default UI filter feature type reference ids (ordered) for specimen view.
     * Though initially implemented, this is not currently used. We marked it for deprecation.
     * However, there is a possibility we take advantage of this field during DT-1811.
     * Thus, it is NOT deprecated any longer.
     */
    filterFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default redux filter state for specimen view
     */
    filterState: Array<BffFilterType>;
    /**
     * Default thumbnail images to show in list view
     */
    listImageFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default redux sort state for specimen view
     */
    sortState: Array<BffSortType>;
    /**
     * Default UI summary feature type reference ids (ordered) for specimen
     */
    summaryFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default UI table column feature type reference ids (ordered) for specimen view
     */
    tableColumnFeatures: Array<ScalarsEnums['String']>;
}

export interface AIO_Grant {
    __typename?: 'AIO_Grant';
    awardee: Organization;
    fundingAgency: Organization;
    grantId: ScalarsEnums['String'];
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    reportSymbol?: Maybe<ScalarsEnums['String']>;
    title: ScalarsEnums['String'];
}

export interface AIO_Project {
    __typename?: 'DataCollectionProject' | 'Program' | 'SubProgram';
    description: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
    $on: $AIO_Project;
}

export interface AIO_Protocol {
    __typename?: 'AIO_Protocol';
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
    url: ScalarsEnums['String'];
}

export interface AIO_Specimen {
    __typename?: 'AIO_Specimen';
    annotations: (args?: { featureTypes?: Maybe<Array<Maybe<ScalarsEnums['String']>>> }) => Maybe<Array<Annotation>>;
    cRID: CRID;
    files?: Maybe<Array<SpecimenFile>>;
    images: (args?: { featureTypes?: Maybe<Array<Maybe<ScalarsEnums['String']>>> }) => Maybe<Array<Image>>;
    measurements: (args?: { featureTypes?: Maybe<Array<Maybe<ScalarsEnums['String']>>> }) => Maybe<Array<Measurement>>;
    projectReferenceIds: Array<ScalarsEnums['String']>;
    referenceId: ScalarsEnums['String'];
    relatedSpecimens?: Maybe<Array<RelatedSpecimen>>;
    specimenType?: Maybe<SpecimenType>;
}

export interface AIO_SpecimenFacetedSearchProperty {
    __typename?: 'AIO_SpecimenFacetedSearchProperty';
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    measurementStats?: Maybe<MeasurementStats>;
    modality?: Maybe<Array<Modality>>;
    type: ScalarsEnums['AIO_SpecimenFacetedSearchPropertyType'];
}

export interface AggregationResult {
    __typename?: 'AggregationResult';
    count?: Maybe<ScalarsEnums['Float']>;
    properties?: Maybe<Array<Maybe<PropertyValueTuple>>>;
}

export interface Annotation {
    __typename?: 'Annotation';
    featureType: FeatureType;
    modality?: Maybe<Array<Modality>>;
    referenceId: ScalarsEnums['String'];
    taxons: Array<Taxon>;
}

export interface AnnotationDisplayProperty {
    __typename?: 'AnnotationDisplayProperty';
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
}

/**
 * A feature associated with an annotation.
 */
export interface AnnotationFeature {
    __typename?: 'AnnotationFeature';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * Whether this AnnotationFeature is a default AnnotationFeature.
     */
    default: ScalarsEnums['Boolean'];
    /**
     * The FeatureType for this AnnotationFeature.
     */
    featureType: FeatureType;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The priority order for sorting the AnnotationFeature.
     */
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface BffContact {
    __typename?: 'BffContact';
    email?: Maybe<WebResourceLink>;
    name?: Maybe<ScalarsEnums['String']>;
}

export interface BffFilterType {
    __typename?: 'BffFilterType';
    field?: Maybe<ScalarsEnums['String']>;
    operator?: Maybe<ScalarsEnums['BffFilterOperator']>;
    value?: Maybe<ScalarsEnums['String']>;
}

export interface BffProgram {
    __typename?: 'BffProgram';
    programLink?: Maybe<WebResourceLink>;
    subProgramLink?: Maybe<WebResourceLink>;
}

export interface BffProject {
    __typename?: 'BffProject';
    program?: Maybe<ScalarsEnums['String']>;
    projectLink?: Maybe<WebResourceLink>;
    subProgram?: Maybe<ScalarsEnums['String']>;
}

export interface BffPublication {
    __typename?: 'BffPublication';
    doiLink?: Maybe<WebResourceLink>;
    name?: Maybe<ScalarsEnums['String']>;
    pubMedLink?: Maybe<WebResourceLink>;
    year?: Maybe<ScalarsEnums['String']>;
}

export interface BffSortType {
    __typename?: 'BffSortType';
    field?: Maybe<ScalarsEnums['String']>;
    order?: Maybe<ScalarsEnums['BffSortOrder']>;
}

/**
 * A representation of a dataset used in the Brain Knowledge Platform Explorer.
 */
export interface BkpDataset {
    __typename?: 'BkpDataset';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The reference id for the dataset's BKP data collection.
     */
    dataCollectionReferenceId: ScalarsEnums['String'];
    /**
     * The description of the dataset.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * A list of metadata associated to the dataset.
     */
    metadata: Array<Metadata>;
    /**
     * The priority order of the dataset.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the dataset's BKP project.
     */
    projectReferenceId: ScalarsEnums['String'];
    /**
     * The reference id for the dataset.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the dataset.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the dataset.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The version of the dataset.
     */
    version: ScalarsEnums['String'];
    /**
     * A list of Visualizations supported by the dataset.
     */
    visualizations: Array<IVisualization>;
}

/**
 * A connection to a list of items.
 */
export interface BkpDatasetsConnection {
    __typename?: 'BkpDatasetsConnection';
    /**
     * A list of edges.
     */
    edges?: Maybe<Array<BkpDatasetsEdge>>;
    /**
     * A flattened list of the nodes.
     */
    nodes?: Maybe<Array<BkpDataset>>;
    /**
     * Information to aid in pagination.
     */
    pageInfo: PageInfo;
    /**
     * Identifies the total count of items in the connection.
     */
    totalCount: ScalarsEnums['Int'];
}

/**
 * An edge in a connection.
 */
export interface BkpDatasetsEdge {
    __typename?: 'BkpDatasetsEdge';
    /**
     * A cursor for use in pagination.
     */
    cursor: ScalarsEnums['String'];
    /**
     * The item at the end of the edge.
     */
    node: BkpDataset;
}

export interface BroadClass {
    __typename?: 'BroadClass';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface CRID {
    __typename?: 'CRID';
    registry: CRIDRegistry;
    symbol: ScalarsEnums['String'];
}

export interface CRIDRegistry {
    __typename?: 'CRIDRegistry';
    description: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
}

export interface CVImage {
    __typename?: 'CVImage';
    featureType: FeatureType;
    properties?: Maybe<CVImageProperty>;
    referenceId: ScalarsEnums['String'];
    url: ScalarsEnums['String'];
}

export interface CVImageProperty {
    __typename?: 'CVImageProperty';
    cellType?: Maybe<ScalarsEnums['String']>;
    comparisonType?: Maybe<ScalarsEnums['String']>;
    gene?: Maybe<ScalarsEnums['String']>;
    metaData?: Maybe<ScalarsEnums['String']>;
    projectReferenceId: ScalarsEnums['String'];
}

export interface CVProperties {
    __typename?: 'CVProperties';
    cellType: Array<ScalarsEnums['String']>;
    comparisonType: Array<ScalarsEnums['String']>;
    gene: (args?: {
        /**
         * @defaultValue `false`
         */
        exact?: Maybe<ScalarsEnums['Boolean']>;
        /**
         * @defaultValue `10`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<SortOrder>;
        text?: Maybe<ScalarsEnums['String']>;
    }) => Array<ScalarsEnums['String']>;
    metaData: Array<ScalarsEnums['String']>;
}

export interface CategoricalDisplayProperty {
    __typename?: 'CategoricalDisplayProperty';
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
}

/**
 * This describes information about an CellGeneType.
 */
export interface CellGene {
    __typename?: 'CellGene';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The DataCollectionId for the cell by gene.
     */
    dataCollectionId: ScalarsEnums['String'];
    /**
     * The Genome of the gene.
     */
    genome: ScalarsEnums['String'];
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The Index of the cell by gene.
     */
    index: ScalarsEnums['Int'];
    /**
     * The Max value for the cell by gene.
     */
    max: ScalarsEnums['Float'];
    /**
     * The Min value for the cell by gene.
     */
    min: ScalarsEnums['Float'];
    /**
     * The gene identifier from external sources.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The Symbol of the gene.
     */
    symbol: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The DataCollection Version for the cell by gene.
     */
    version: ScalarsEnums['String'];
}

/**
 * A connection to a list of items.
 */
export interface CellGenesConnection {
    __typename?: 'CellGenesConnection';
    /**
     * A list of edges.
     */
    edges?: Maybe<Array<CellGenesEdge>>;
    /**
     * A flattened list of the nodes.
     */
    nodes?: Maybe<Array<CellGene>>;
    /**
     * Information to aid in pagination.
     */
    pageInfo: PageInfo;
    /**
     * Identifies the total count of items in the connection.
     */
    totalCount: ScalarsEnums['Int'];
}

/**
 * An edge in a connection.
 */
export interface CellGenesEdge {
    __typename?: 'CellGenesEdge';
    /**
     * A cursor for use in pagination.
     */
    cursor: ScalarsEnums['String'];
    /**
     * The item at the end of the edge.
     */
    node: CellGene;
}

/**
 * This describes information about a CellInfoType.
 */
export interface CellInfo {
    __typename?: 'CellInfo';
    /**
     * The Id value for the cell info type.
     */
    id?: Maybe<ScalarsEnums['String']>;
    /**
     * The Index value for the cell info type.
     */
    index?: Maybe<ScalarsEnums['Int']>;
    /**
     * The Properties value for the cell info type.
     */
    properties?: Maybe<Array<Maybe<PropertyValueTuple>>>;
}

/**
 * A connection to a list of items.
 */
export interface CellPropertiesConnection {
    __typename?: 'CellPropertiesConnection';
    /**
     * A list of edges.
     */
    edges?: Maybe<Array<CellPropertiesEdge>>;
    /**
     * A flattened list of the nodes.
     */
    nodes?: Maybe<Array<CellProperty>>;
    /**
     * Information to aid in pagination.
     */
    pageInfo: PageInfo;
    /**
     * Identifies the total count of items in the connection.
     */
    totalCount: ScalarsEnums['Int'];
}

/**
 * An edge in a connection.
 */
export interface CellPropertiesEdge {
    __typename?: 'CellPropertiesEdge';
    /**
     * A cursor for use in pagination.
     */
    cursor: ScalarsEnums['String'];
    /**
     * The item at the end of the edge.
     */
    node: CellProperty;
}

/**
 * Cell property holds values that will be used to populate the FeatureTypeValueIndex.
 */
export interface CellProperty {
    __typename?: 'CellProperty';
    /**
     * The color of the cell property.
     */
    color?: Maybe<ScalarsEnums['String']>;
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The dataset that the cell property belongs to.
     */
    dataset?: Maybe<IDataset>;
    /**
     * The property's FeatureType.
     */
    featureType: FeatureType;
    /**
     * The FeatureTypeValueIndex associated with the cell property.
     */
    featureTypeValueIndex: FeatureTypeValueIndex;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface CellTypeAnatomyImage {
    __typename?: 'CellTypeAnatomyImage';
    alt?: Maybe<ScalarsEnums['String']>;
    src?: Maybe<ScalarsEnums['String']>;
}

export interface CellTypeTaxonomy {
    __typename?: 'CellTypeTaxonomy';
    name?: Maybe<ScalarsEnums['String']>;
    nodes?: Maybe<Array<Maybe<CellTypeTaxonomyNode>>>;
}

/**
 * Through iterations from S3 -> EBI,
 * lets try to adhere to this structure so the client contract is the same
 */
export interface CellTypeTaxonomyHierarchyNode {
    __typename?: 'CellTypeTaxonomyHierarchyNode';
    accessionId: ScalarsEnums['String'];
    aliases?: Maybe<Array<ScalarsEnums['String']>>;
    classLabel?: Maybe<ScalarsEnums['String']>;
    color?: Maybe<ScalarsEnums['String']>;
    dataSections: (args?: { taxonomyId?: Maybe<ScalarsEnums['String']> }) => Maybe<ScalarsEnums['JSON']>;
    fullOntologyName?: Maybe<ScalarsEnums['String']>;
    id?: Maybe<ScalarsEnums['String']>;
    label?: Maybe<ScalarsEnums['String']>;
    nfForestMarkers?: Maybe<Array<WebResourceLink>>;
    ontologyIri?: Maybe<WebResourceLink>;
    parentId?: Maybe<ScalarsEnums['String']>;
    rank?: Maybe<ScalarsEnums['String']>;
    references?: Maybe<Array<ScalarsEnums['String']>>;
    summary?: Maybe<ScalarsEnums['String']>;
    symbol?: Maybe<ScalarsEnums['String']>;
    tags?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
}

export interface CellTypeTaxonomyInfo {
    __typename?: 'CellTypeTaxonomyInfo';
    accessionId: ScalarsEnums['String'];
    age?: Maybe<ScalarsEnums['String']>;
    anatomy?: Maybe<ScalarsEnums['String']>;
    anatomyImages?: Maybe<Array<Maybe<CellTypeAnatomyImage>>>;
    attribution?: Maybe<ScalarsEnums['String']>;
    azimuthHeader?: Maybe<ScalarsEnums['String']>;
    azimuthLink?: Maybe<ScalarsEnums['String']>;
    azimuthText?: Maybe<ScalarsEnums['String']>;
    cellClassesCount?: Maybe<ScalarsEnums['String']>;
    cellSubclassesCount?: Maybe<ScalarsEnums['String']>;
    cellTypesCount?: Maybe<ScalarsEnums['String']>;
    crossSpeciesImages?: Maybe<Array<ScalarsEnums['String']>>;
    datasets: (args?: { taxonomyId?: Maybe<ScalarsEnums['String']> }) => Maybe<Array<Maybe<CellTypesDatasetInfo>>>;
    header?: Maybe<ScalarsEnums['String']>;
    mainDescription?: Maybe<ScalarsEnums['String']>;
    nodes: (args?: { accessionId?: Maybe<ScalarsEnums['String']> }) => Maybe<Array<CellTypeTaxonomyHierarchyNode>>;
    sex?: Maybe<ScalarsEnums['String']>;
    species?: Maybe<ScalarsEnums['String']>;
    subDescription?: Maybe<ScalarsEnums['String']>;
}

export interface CellTypeTaxonomyNode {
    __typename?: 'CellTypeTaxonomyNode';
    accessionId?: Maybe<ScalarsEnums['String']>;
    alias?: Maybe<ScalarsEnums['String']>;
    childrenIds?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    color?: Maybe<ScalarsEnums['String']>;
    label?: Maybe<ScalarsEnums['String']>;
    order?: Maybe<ScalarsEnums['Int']>;
    parentId?: Maybe<ScalarsEnums['String']>;
}

export interface CellTypesDatasetInfo {
    __typename?: 'CellTypesDatasetInfo';
    cellsNuclei?: Maybe<ScalarsEnums['String']>;
    dataset?: Maybe<ScalarsEnums['String']>;
    downloadLink?: Maybe<ScalarsEnums['String']>;
    exploreLink?: Maybe<ScalarsEnums['String']>;
    text?: Maybe<ScalarsEnums['String']>;
}

export interface Cluster {
    __typename?: 'Cluster';
    name?: Maybe<ScalarsEnums['String']>;
}

/**
 * Color gradient numeric color type.
 */
export interface ColorGradient {
    __typename?: 'ColorGradient';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The colors in the gradient. Elements should be sorted where the first element corresponds to the color of the minimum value and the last corresponds to the maximum value.
     */
    gradient: Array<ScalarsEnums['String']>;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The maximum clamp value for the color range.
     */
    maxClamp: ScalarsEnums['Float'];
    /**
     * The minimum clamp value for the color range.
     */
    minClamp: ScalarsEnums['Float'];
    /**
     * The color for null values.
     */
    nullColor: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

/**
 * Color map numeric color type.
 */
export interface ColorMap {
    __typename?: 'ColorMap';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * Whether to invert the color map direction.
     */
    invertMap: ScalarsEnums['Boolean'];
    /**
     * The maximum clamp value for the color range.
     */
    maxClamp: ScalarsEnums['Float'];
    /**
     * The minimum clamp value for the color range.
     */
    minClamp: ScalarsEnums['Float'];
    /**
     * The name of the color map, taken from available values here - https://observablehq.com/@d3/color-schemes.
     */
    name: ScalarsEnums['String'];
    /**
     * The color for null values.
     */
    nullColor: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

/**
 * A set of color information.
 */
export interface ColorSetInfo {
    __typename?: 'ColorSetInfo';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The FeatureType for the color info.
     */
    featureType: FeatureType;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The type of the ColorInfo.
     */
    type: ScalarsEnums['ColorType'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface Contact {
    __typename?: 'Contact';
    email: ScalarsEnums['String'];
    person: Person;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
}

export interface ContactArrayDisplayProperty {
    __typename?: 'ContactArrayDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<Array<BffContact>>;
}

/**
 * Coronal grid visualization type.
 */
export interface CoronalGrid {
    __typename?: 'CoronalGrid';
    /**
     * The annotations for the Visualization.
     */
    annotations: Array<IAnnotation>;
    /**
     * The colorable features of the CoronalGrid.
     */
    color: Array<IColorInfo>;
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The description of the Visualization.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The priority order of the Visualization.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the Visualization.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the Visualization.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the Visualization.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The url for the CoronalGrid.
     */
    url: ScalarsEnums['URL'];
}

export interface CorticalLayer {
    __typename?: 'CorticalLayer';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface DataCollection {
    __typename?: 'DataCollection';
    accessControl?: Maybe<ScalarsEnums['String']>;
    completionState?: Maybe<ScalarsEnums['String']>;
    description: ScalarsEnums['String'];
    lastUpdatedAtDate?: Maybe<ScalarsEnums['Date']>;
    modality?: Maybe<Array<Maybe<Modality>>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    publication?: Maybe<Array<Maybe<Publication>>>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    species?: Maybe<Array<Maybe<Species>>>;
    specimenCount?: Maybe<Array<Maybe<SpecimenCount>>>;
    specimenType?: Maybe<Array<Maybe<SpecimenType>>>;
    technique?: Maybe<Array<Maybe<Technique>>>;
    title: ScalarsEnums['String'];
    webResources?: Maybe<Array<Maybe<UrlResource>>>;
}

export interface DataCollectionDisplay {
    __typename?: 'DataCollectionDisplay';
    accessControl?: Maybe<StringDisplayProperty>;
    completionState?: Maybe<StringDisplayProperty>;
    description?: Maybe<StringDisplayProperty>;
    lastUpdatedAtDate?: Maybe<StringDisplayProperty>;
    modality?: Maybe<StringArrayDisplayProperty>;
    referenceId: ScalarsEnums['String'];
    shortTitle: StringDisplayProperty;
    species?: Maybe<StringArrayDisplayProperty>;
    specimenType?: Maybe<StringArrayDisplayProperty>;
    technique?: Maybe<StringArrayDisplayProperty>;
    totalSpecimenCount?: Maybe<IntDisplayProperty>;
    webResources?: Maybe<WebResourceLinkArrayDisplayProperty>;
}

export interface DataCollectionDisplayProject {
    __typename?: 'DataCollectionDisplayProject';
    associationsHeader?: Maybe<PropertyDisplayNameMetadata>;
    capabilities?: Maybe<Array<Maybe<ScalarsEnums['ProjectCapabilities']>>>;
    citation?: Maybe<StringDisplayProperty>;
    contact?: Maybe<ContactArrayDisplayProperty>;
    contributor?: Maybe<WebResourceLinkArrayDisplayProperty>;
    dataCollection?: Maybe<Array<Maybe<DataCollectionDisplay>>>;
    dataCollectionsHeader?: Maybe<PropertyDisplayNameMetadata>;
    dataCreator?: Maybe<StringArrayDisplayProperty>;
    description?: Maybe<StringDisplayProperty>;
    detailsHeader?: Maybe<PropertyDisplayNameMetadata>;
    doi?: Maybe<WebResourceLinkDisplayProperty>;
    fundingHeader?: Maybe<PropertyDisplayNameMetadata>;
    grant?: Maybe<Array<Maybe<WebResourceLink>>>;
    hasSpecimensPage: ScalarsEnums['Boolean'];
    highlightedWebResources?: Maybe<WebResourceLinkArrayDisplayProperty>;
    license?: Maybe<WebResourceLinkArrayDisplayProperty>;
    modality?: Maybe<StringArrayDisplayProperty>;
    program?: Maybe<ProgramDisplayProperty>;
    programShortTitle?: Maybe<StringDisplayProperty>;
    project?: Maybe<ProjectDisplayArrayProperty>;
    projectDescription?: Maybe<PropertyDisplayNameMetadata>;
    protocol?: Maybe<Array<Maybe<WebResourceLink>>>;
    protocolHeader?: Maybe<PropertyDisplayNameMetadata>;
    publication?: Maybe<PublicationDisplayProperty>;
    publisher?: Maybe<WebResourceLinkDisplayProperty>;
    publishingInfoHeader?: Maybe<PropertyDisplayNameMetadata>;
    referenceId: ScalarsEnums['String'];
    shortTitle: StringDisplayProperty;
    species?: Maybe<StringArrayDisplayProperty>;
    specimenType?: Maybe<StringArrayDisplayProperty>;
    subProgramShortTitle?: Maybe<StringDisplayProperty>;
    technique?: Maybe<StringArrayDisplayProperty>;
    title: StringDisplayProperty;
    year?: Maybe<StringArrayDisplayProperty>;
}

export interface DataCollectionProject {
    __typename?: 'DataCollectionProject';
    capabilities?: Maybe<Array<Maybe<ScalarsEnums['ProjectCapabilities']>>>;
    citation?: Maybe<ScalarsEnums['String']>;
    contact?: Maybe<Array<Maybe<Contact>>>;
    dataCollection?: Maybe<Array<Maybe<DataCollection>>>;
    dataContributor?: Maybe<Array<Maybe<DataContributor>>>;
    dataCreator?: Maybe<Array<Maybe<DataCreator>>>;
    dataPublicationYear?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    description: ScalarsEnums['String'];
    doiSymbol?: Maybe<ScalarsEnums['String']>;
    grant?: Maybe<Array<Maybe<AIO_Grant>>>;
    hasSpecimen: ScalarsEnums['Boolean'];
    hasSpecimenFiles: ScalarsEnums['Boolean'];
    highlightedWebResources?: Maybe<Array<Maybe<UrlResource>>>;
    informationWebResource?: Maybe<UrlResource>;
    license?: Maybe<Array<Maybe<License>>>;
    modality?: Maybe<Array<Maybe<Modality>>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    protocol?: Maybe<Array<Maybe<AIO_Protocol>>>;
    publication?: Maybe<Array<Maybe<Publication>>>;
    publisher?: Maybe<Publisher>;
    readMeFile?: Maybe<ScalarsEnums['String']>;
    referenceId: ScalarsEnums['String'];
    relatedProjects?: Maybe<Array<Maybe<DataCollectionProject>>>;
    shortTitle: ScalarsEnums['String'];
    species?: Maybe<Array<Maybe<Species>>>;
    specimenType?: Maybe<Array<Maybe<SpecimenType>>>;
    subProgram?: Maybe<Array<Maybe<SubProgram>>>;
    supersedes?: Maybe<Array<ScalarsEnums['String']>>;
    taxonomies?: Maybe<Array<Taxonomy>>;
    technique?: Maybe<Array<Maybe<Technique>>>;
    title: ScalarsEnums['String'];
}

export interface DataContributor {
    __typename?: 'DataContributor';
    agentType: ScalarsEnums['String'];
    organization?: Maybe<Organization>;
    person?: Maybe<Person>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
}

export interface DataCreator {
    __typename?: 'DataCreator';
    agentType: ScalarsEnums['String'];
    organization?: Maybe<Organization>;
    person?: Maybe<Person>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
}

export interface DataSet {
    __typename?: 'TranscriptomicDataSet';
    modality?: Maybe<Array<Maybe<Modality>>>;
    name?: Maybe<ScalarsEnums['String']>;
    $on: $DataSet;
}

/**
 * Represents a DataType entity.
 */
export interface DataType {
    __typename?: 'DataType';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * A JSON schema used to validate the data field of a metadata object that uses this DataType.
     */
    dataSchema: ScalarsEnums['JSON'];
    /**
     * Text describing any relevant details of the DataType.
     */
    description?: Maybe<ScalarsEnums['String']>;
    id: ScalarsEnums['UUID'];
    name: ScalarsEnums['String'];
    /**
     * Any projects ExternalReferences associated to the DataType.
     */
    projects: Array<ExternalReference>;
    /**
     * The TypeState of the DataType.
     */
    state: ScalarsEnums['TypeState'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    version: ScalarsEnums['Float'];
}

export interface DatasetDisplayProperty {
    __typename?: 'DatasetDisplayProperty';
    defaultFilter?: Maybe<ScalarsEnums['String']>;
    defaultSort?: Maybe<ScalarsEnums['String']>;
    displayFeatures?: Maybe<Array<FeatureDisplayProperty>>;
    referenceId?: Maybe<ScalarsEnums['String']>;
    type?: Maybe<ScalarsEnums['DisplayPropertyType']>;
}

export interface DefaultProjectInfo {
    __typename?: 'DefaultProjectInfo';
    dataCollectionIdDefaults?: Maybe<Array<Maybe<ABCAtlasDefaultOptions>>>;
    defaultProjectReferenceId: ScalarsEnums['String'];
}

export interface DisplayProperty {
    __typename?: 'DatasetDisplayProperty' | 'ProjectDisplayProperty' | 'SpecimenTypeDisplayProperty';
    referenceId?: Maybe<ScalarsEnums['String']>;
    type?: Maybe<ScalarsEnums['DisplayPropertyType']>;
    $on: $DisplayProperty;
}

export interface Donor {
    __typename?: 'Donor';
    name?: Maybe<ScalarsEnums['String']>;
    sex?: Maybe<ScalarsEnums['String']>;
}

export interface DownloadFile {
    __typename?: 'DownloadFile';
    displayName?: Maybe<ScalarsEnums['String']>;
    downloadUrl?: Maybe<ScalarsEnums['String']>;
}

/**
 * Dynamic grid visualization type.
 */
export interface DynamicGrid {
    __typename?: 'DynamicGrid';
    /**
     * The annotations for the Visualization.
     */
    annotations: Array<IAnnotation>;
    /**
     * The connection to a BKP Dataset.
     */
    bkpDataset: BkpDataset;
    /**
     * The colorable features of the DynamicGrid.
     */
    color: Array<IColorInfo>;
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The description of the Visualization.
     */
    description: ScalarsEnums['String'];
    /**
     * The feature type that corresponds to the grid elements.
     */
    gridFeature: FeatureType;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The priority order of the Visualization.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the Visualization.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the Visualization.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the Visualization.
     */
    title: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The url for the DynamicGrid.
     */
    url: ScalarsEnums['URL'];
}

/**
 * Represents a ExternalReference entity.
 */
export interface ExternalReference {
    __typename?: 'ExternalReference';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * A URI to the external resource.
     */
    uri?: Maybe<ScalarsEnums['URL']>;
    /**
     * A UUID to the external resource.
     */
    uuid?: Maybe<ScalarsEnums['UUID']>;
}

export interface FeatureDisplayProperty {
    __typename?:
        | 'AnnotationDisplayProperty'
        | 'CategoricalDisplayProperty'
        | 'ImageDisplayProperty'
        | 'MeasurementDisplayProperty'
        | 'NumericDisplayProperty'
        | 'TreeDisplayProperty';
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
    $on: $FeatureDisplayProperty;
}

export interface FeatureMatrixAggregationResult {
    __typename?: 'FeatureMatrixAggregationResult';
    groupByResults?: Maybe<Array<Maybe<FeatureMatrixGroupByResult>>>;
    max?: Maybe<ScalarsEnums['Float']>;
    mean?: Maybe<ScalarsEnums['Float']>;
    min?: Maybe<ScalarsEnums['Float']>;
}

export interface FeatureMatrixGroupByResult {
    __typename?: 'FeatureMatrixGroupByResult';
    featureResults?: Maybe<Array<Maybe<FeatureResult>>>;
    row?: Maybe<ScalarsEnums['String']>;
}

export interface FeatureResult {
    __typename?: 'FeatureResult';
    feature?: Maybe<ScalarsEnums['String']>;
    value?: Maybe<ScalarsEnums['Float']>;
}

export interface FeatureType {
    __typename?: 'FeatureType';
    description: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
}

/**
 * Unique feature type and value indexing.
 */
export interface FeatureTypeValueIndex {
    __typename?: 'FeatureTypeValueIndex';
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The feature type we are indexing on.
     */
    featureType: FeatureType;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The index of this feature type value.
     */
    index: ScalarsEnums['Int'];
    /**
     * The parent reference identifier of the feature type value index.
     */
    parentReferenceId?: Maybe<ScalarsEnums['String']>;
    /**
     * The priority ordering for sorting the feature type value index.
     */
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    /**
     * The reference identifier of the feature type value index.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The value of this feature type value.
     */
    value: ScalarsEnums['String'];
}

export interface FileArchive {
    __typename?: 'FileArchive';
    name: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
}

export interface FilterField {
    __typename?: 'FilterField';
    alias?: Maybe<ScalarsEnums['String']>;
    displayName?: Maybe<ScalarsEnums['String']>;
    propertyName?: Maybe<ScalarsEnums['String']>;
}

export interface Gene {
    __typename?: 'Gene';
    entrezId?: Maybe<ScalarsEnums['String']>;
    genome?: Maybe<ScalarsEnums['String']>;
    symbol?: Maybe<ScalarsEnums['String']>;
}

export interface Genotype {
    __typename?: 'Genotype';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface Hemisphere {
    __typename?: 'Hemisphere';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface HttpStatusCodeResponse {
    __typename?: 'HttpStatusCodeResponse';
    code?: Maybe<ScalarsEnums['Int']>;
    status?: Maybe<ScalarsEnums['String']>;
}

/**
 * An interface for annotations.
 */
export interface IAnnotation {
    __typename?: 'SvgAnnotation';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The description for the annotation.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The priority order for sorting the annotation.
     */
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    /**
     * The reference identifier of the annotation.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the annotation.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the annotation.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $IAnnotation;
}

/**
 * An interface for color information.
 */
export interface IColorInfo {
    __typename?: 'ColorSetInfo';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The type of the ColorInfo.
     */
    type: ScalarsEnums['ColorType'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $IColorInfo;
}

/**
 * An interface for datasets.
 */
export interface IDataset {
    __typename?: 'BkpDataset';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The description of the dataset.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The priority order of the dataset.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the dataset.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the dataset.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the dataset.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The version of the dataset.
     */
    version: ScalarsEnums['String'];
    $on: $IDataset;
}

/**
 * An interface for _all_ Gene-related entities to implement.
 */
export interface IGene {
    __typename?: 'CellGene';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The genome of the gene.
     */
    genome: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The gene identifier from external sources.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The symbol of the gene.
     */
    symbol: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $IGene;
}

/**
 * An interface for numeric property coloring.
 */
export interface INumericColor {
    __typename?: 'ColorGradient' | 'ColorMap';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The maximum clamp value for the color range.
     */
    maxClamp: ScalarsEnums['Float'];
    /**
     * The minimum clamp value for the color range.
     */
    minClamp: ScalarsEnums['Float'];
    /**
     * The color for null values.
     */
    nullColor: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $INumericColor;
}

/**
 * An interface that is used to describe a property.
 */
export interface IProperty {
    __typename?: 'CellProperty';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The property's FeatureType.
     */
    featureType: FeatureType;
    id: ScalarsEnums['UUID'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $IProperty;
}

/**
 * An interface for visualizations.
 */
export interface IVisualization {
    __typename?: 'CoronalGrid' | 'DynamicGrid' | 'Umap';
    /**
     * The annotations for the Visualization.
     */
    annotations: Array<IAnnotation>;
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The description of the Visualization.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The priority order of the Visualization.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the Visualization.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the Visualization.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the Visualization.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    $on: $IVisualization;
}

export interface Image {
    __typename?: 'Image';
    annotated?: Maybe<ScalarsEnums['Boolean']>;
    bytes: ScalarsEnums['String'];
    featureType: FeatureType;
    height: ScalarsEnums['Int'];
    modality?: Maybe<Array<Modality>>;
    referenceId: ScalarsEnums['String'];
    url: ScalarsEnums['String'];
    width: ScalarsEnums['Int'];
}

export interface ImageDimensions {
    __typename?: 'ImageDimensions';
    height: ScalarsEnums['Int'];
    width: ScalarsEnums['Int'];
}

export interface ImageDisplayProperty {
    __typename?: 'ImageDisplayProperty';
    dimensions?: Maybe<ImageDimensions>;
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
}

export interface InitializeDownloadResponse {
    __typename?: 'InitializeDownloadResponse';
    signedUrl?: Maybe<ScalarsEnums['String']>;
}

export interface InitializeUploadResponse {
    __typename?: 'InitializeUploadResponse';
    executionID?: Maybe<ScalarsEnums['String']>;
    signedUrl?: Maybe<ScalarsEnums['String']>;
}

export interface IntDisplayProperty {
    __typename?: 'IntDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<ScalarsEnums['Int']>;
}

export interface ItemCount {
    __typename?: 'ItemCount';
    count?: Maybe<ScalarsEnums['Int']>;
    name?: Maybe<ScalarsEnums['String']>;
}

export interface License {
    __typename?: 'License';
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
    urlResource?: Maybe<UrlResource>;
}

export interface MappingResult {
    __typename?: 'MappingResult';
    ETA?: Maybe<ScalarsEnums['String']>;
    algorithm?: Maybe<ScalarsEnums['String']>;
    algorithmStatus?: Maybe<ScalarsEnums['String']>;
    endTime?: Maybe<ScalarsEnums['String']>;
    executionID?: Maybe<ScalarsEnums['String']>;
    fileName?: Maybe<ScalarsEnums['String']>;
    fileSize?: Maybe<ScalarsEnums['String']>;
    mappedCellsCount?: Maybe<ScalarsEnums['String']>;
    mappedGenesCount?: Maybe<ScalarsEnums['String']>;
    reference?: Maybe<ScalarsEnums['String']>;
    referenceDataDisplayName?: Maybe<ScalarsEnums['String']>;
    startTime?: Maybe<ScalarsEnums['String']>;
    workflowDisplayName?: Maybe<ScalarsEnums['String']>;
    workflowStatus?: Maybe<ScalarsEnums['String']>;
}

export interface Measurement {
    __typename?: 'Measurement';
    featureType: FeatureType;
    measurementType: ScalarsEnums['MeasurementType'];
    modality?: Maybe<Array<Modality>>;
    referenceId: ScalarsEnums['String'];
    unit?: Maybe<ScalarsEnums['String']>;
    value?: Maybe<ScalarsEnums['String']>;
}

export interface MeasurementDisplayProperty {
    __typename?: 'MeasurementDisplayProperty';
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    measurementStats?: Maybe<MeasurementStats>;
    measurementType?: Maybe<ScalarsEnums['MeasurementType']>;
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
    unit?: Maybe<ScalarsEnums['String']>;
}

export interface MeasurementStats {
    __typename?: 'MeasurementStats';
    avg?: Maybe<ScalarsEnums['Float']>;
    max?: Maybe<ScalarsEnums['Float']>;
    min?: Maybe<ScalarsEnums['Float']>;
    std?: Maybe<ScalarsEnums['Float']>;
}

/**
 * Holds arbitrary Metadata. Schema enforced by DataType relationship.
 */
export interface Metadata {
    __typename?: 'Metadata';
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The Metadata itself. A JSON blob validated against the schema on the DataType.
     */
    data: ScalarsEnums['JSON'];
    id: ScalarsEnums['UUID'];
    /**
     * The type of this Metadata. Used for validating schema and querying by DataType.
     */
    type: DataType;
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface Modality {
    __typename?: 'Modality';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface NumericDisplayProperty {
    __typename?: 'NumericDisplayProperty';
    defaultFilterMax?: Maybe<ScalarsEnums['Float']>;
    defaultFilterMin?: Maybe<ScalarsEnums['Float']>;
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    includeZeros: ScalarsEnums['Boolean'];
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    nullColoring: ScalarsEnums['NullDisplayOption'];
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
}

/**
 * A connection to a list of items.
 */
export interface NumericPropertiesConnection {
    __typename?: 'NumericPropertiesConnection';
    /**
     * A list of edges.
     */
    edges?: Maybe<Array<NumericPropertiesEdge>>;
    /**
     * A flattened list of the nodes.
     */
    nodes?: Maybe<Array<NumericProperty>>;
    /**
     * Information to aid in pagination.
     */
    pageInfo: PageInfo;
    /**
     * Identifies the total count of items in the connection.
     */
    totalCount: ScalarsEnums['Int'];
}

/**
 * An edge in a connection.
 */
export interface NumericPropertiesEdge {
    __typename?: 'NumericPropertiesEdge';
    /**
     * A cursor for use in pagination.
     */
    cursor: ScalarsEnums['String'];
    /**
     * The item at the end of the edge.
     */
    node: NumericProperty;
}

/**
 * Numeric property holds values that will be used to describe the FeatureType.
 */
export interface NumericProperty {
    __typename?: 'NumericProperty';
    /**
     * The average value for the property.
     */
    avg: ScalarsEnums['Float'];
    /**
     * The coloring of the numeric property.
     */
    color: INumericColor;
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The dataset that the numeric property belongs to.
     */
    dataset: IDataset;
    /**
     * The property's FeatureType.
     */
    featureType: FeatureType;
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The maximum value for the property.
     */
    max: ScalarsEnums['Float'];
    /**
     * The minimum value for the property.
     */
    min: ScalarsEnums['Float'];
    /**
     * The standard deviation value for the property.
     */
    std: ScalarsEnums['Float'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface Organization {
    __typename?: 'Organization';
    name: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    rorSymbol?: Maybe<ScalarsEnums['String']>;
}

/**
 * Information about pagination in a connection.
 */
export interface PageInfo {
    __typename?: 'PageInfo';
    /**
     * When paginating forwards, the cursor to continue.
     */
    endCursor?: Maybe<ScalarsEnums['String']>;
    /**
     * Indicates whether more edges exist following the set defined by the clients arguments.
     */
    hasNextPage: ScalarsEnums['Boolean'];
    /**
     * Indicates whether more edges exist prior the set defined by the clients arguments.
     */
    hasPreviousPage: ScalarsEnums['Boolean'];
    /**
     * When paginating backwards, the cursor to continue.
     */
    startCursor?: Maybe<ScalarsEnums['String']>;
}

export interface PathologyImage {
    __typename?: 'PathologyImage';
    description: ScalarsEnums['String'];
    donorReferenceId: ScalarsEnums['String'];
    featureType: FeatureType;
    region: ScalarsEnums['String'];
    slide: ScalarsEnums['String'];
    tileSource?: Maybe<TileSource>;
}

export interface PathologyImageMetadata {
    __typename?: 'PathologyImageMetadata';
    region: ScalarsEnums['String'];
    slides: Array<ScalarsEnums['String']>;
}

export interface PathologyImageProperties {
    __typename?: 'PathologyImageProperties';
    donorReferenceId: ScalarsEnums['String'];
    properties: Array<PathologyImageMetadata>;
}

export interface Person {
    __typename?: 'Person';
    ORCID?: Maybe<ScalarsEnums['String']>;
    familyName: ScalarsEnums['String'];
    givenName: ScalarsEnums['String'];
    name: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
}

export interface Program {
    __typename?: 'Program';
    description: ScalarsEnums['String'];
    informationWebResource?: Maybe<UrlResource>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
}

export interface ProgramDisplayProperty {
    __typename?: 'ProgramDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value: Array<BffProgram>;
}

export interface ProjectDisplayArrayProperty {
    __typename?: 'ProjectDisplayArrayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value: Array<BffProject>;
}

export interface ProjectDisplayProperty {
    __typename?: 'ProjectDisplayProperty';
    defaultFilter?: Maybe<ScalarsEnums['String']>;
    defaultSort?: Maybe<ScalarsEnums['String']>;
    displayFeatures?: Maybe<Array<FeatureDisplayProperty>>;
    referenceId?: Maybe<ScalarsEnums['String']>;
    type?: Maybe<ScalarsEnums['DisplayPropertyType']>;
}

export interface PropertyDisplayNameMetadata {
    __typename?: 'PropertyDisplayNameMetadata';
    description: ScalarsEnums['String'];
    longName: ScalarsEnums['String'];
    shortName: ScalarsEnums['String'];
}

export interface PropertyValueTuple {
    __typename?: 'PropertyValueTuple';
    property?: Maybe<ScalarsEnums['String']>;
    value?: Maybe<ScalarsEnums['String']>;
}

export interface Publication {
    __typename?: 'Publication';
    author: Person;
    doiSymbol: ScalarsEnums['String'];
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    publicationYear: ScalarsEnums['String'];
    pubmedId?: Maybe<ScalarsEnums['String']>;
    referenceId: ScalarsEnums['String'];
    title?: Maybe<ScalarsEnums['String']>;
}

export interface PublicationDisplayProperty {
    __typename?: 'PublicationDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value: Array<BffPublication>;
}

export interface Publisher {
    __typename?: 'Publisher';
    organization: Organization;
}

export interface Region {
    __typename?: 'Region';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface RelatedSpecimen {
    __typename?: 'RelatedSpecimen';
    relationship: ScalarsEnums['SpecimenRelationship'];
    specimenReferenceIds: Array<ScalarsEnums['String']>;
}

export interface Species {
    __typename?: 'Species';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface Specimen {
    __typename?: 'Specimen';
    broadClass?: Maybe<BroadClass>;
    cluster?: Maybe<Cluster>;
    corticalLayer?: Maybe<Array<Maybe<CorticalLayer>>>;
    dataSet?: Maybe<ScalarsEnums['String']>;
    donor?: Maybe<Donor>;
    genotype?: Maybe<Genotype>;
    hemisphere?: Maybe<Hemisphere>;
    name?: Maybe<ScalarsEnums['String']>;
    region?: Maybe<Array<Maybe<Region>>>;
    specimenType?: Maybe<ScalarsEnums['String']>;
    subclass?: Maybe<Subclass>;
    subspecimenCount?: Maybe<ScalarsEnums['Int']>;
    subspecimenType?: Maybe<ScalarsEnums['String']>;
}

export interface SpecimenCount {
    __typename?: 'SpecimenCount';
    specimenCount?: Maybe<ScalarsEnums['Int']>;
    specimenType: SpecimenType;
}

export interface SpecimenExportResult {
    __typename?: 'SpecimenExportResult';
    errorMessage?: Maybe<ScalarsEnums['String']>;
    status: ScalarsEnums['ExportStatus'];
    url?: Maybe<ScalarsEnums['String']>;
}

export interface SpecimenFile {
    __typename?: 'SpecimenFile';
    archive?: Maybe<FileArchive>;
    checksum?: Maybe<ScalarsEnums['String']>;
    name: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    type: ScalarsEnums['String'];
    uri: ScalarsEnums['String'];
}

export interface SpecimenType {
    __typename?: 'SpecimenType';
    name: ScalarsEnums['String'];
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId?: Maybe<ScalarsEnums['String']>;
}

export interface SpecimenTypeDisplayProperty {
    __typename?: 'SpecimenTypeDisplayProperty';
    defaultFilter?: Maybe<ScalarsEnums['String']>;
    defaultSort?: Maybe<ScalarsEnums['String']>;
    displayFeatures?: Maybe<Array<FeatureDisplayProperty>>;
    projectReferenceId?: Maybe<ScalarsEnums['String']>;
    referenceId?: Maybe<ScalarsEnums['String']>;
    type?: Maybe<ScalarsEnums['DisplayPropertyType']>;
}

export interface SpecimenViewDefaultOptions {
    __typename?: 'SpecimenViewDefaultOptions';
    /**
     * Default UI filter feature type reference ids (ordered) for specimen view.
     * Though initially implemented, this is not currently used. We marked it for deprecation.
     * However, there is a possibility we take advantage of this field during DT-1811.
     * Thus, it is NOT deprecated any longer.
     */
    filterFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default redux filter state for specimen view
     */
    filterState: Array<BffFilterType>;
    /**
     * Default thumbnail images to show in list view
     */
    listImageFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default redux sort state for specimen view
     */
    sortState: Array<BffSortType>;
    /**
     * Default UI summary feature type reference ids (ordered) for specimen
     */
    summaryFeatures: Array<ScalarsEnums['String']>;
    /**
     * Default UI table column feature type reference ids (ordered) for specimen view
     */
    tableColumnFeatures: Array<ScalarsEnums['String']>;
}

export interface StringArrayDisplayProperty {
    __typename?: 'StringArrayDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
}

export interface StringDisplayProperty {
    __typename?: 'StringDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<ScalarsEnums['String']>;
}

export interface SubProgram {
    __typename?: 'SubProgram';
    description: ScalarsEnums['String'];
    informationWebResource?: Maybe<UrlResource>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    program?: Maybe<Program>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
}

export interface Subclass {
    __typename?: 'Subclass';
    name?: Maybe<ScalarsEnums['String']>;
}

/**
 * An SVG annotation.
 */
export interface SvgAnnotation {
    __typename?: 'SvgAnnotation';
    /**
     * The annotation features for the SVG annotation.
     */
    annotationFeatures: Array<AnnotationFeature>;
    /**
     * The type of the SVG annotation.
     */
    annotationType: ScalarsEnums['AnnotationType'];
    /**
     * The url for the SVG annotation.
     */
    baseUrl: ScalarsEnums['URL'];
    /**
     * Datetime the entity was created.
     */
    createdAt: ScalarsEnums['DateTime'];
    /**
     * User that created the entity.
     */
    createdBy: ScalarsEnums['String'];
    /**
     * The description for the annotation.
     */
    description: ScalarsEnums['String'];
    /**
     * Id of the entity.
     */
    id: ScalarsEnums['UUID'];
    /**
     * The priority order for sorting the annotation.
     */
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    /**
     * The reference identifier of the annotation.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the annotation.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the annotation.
     */
    title: ScalarsEnums['String'];
    /**
     * Datetime the entity was updated.
     */
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    /**
     * User that updated the entity.
     */
    updatedBy?: Maybe<ScalarsEnums['String']>;
}

export interface Taxon {
    __typename?: 'Taxon';
    cRID: CRID;
    description: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    symbol: ScalarsEnums['String'];
}

export interface Taxonomy {
    __typename?: 'Taxonomy';
    description: ScalarsEnums['String'];
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    taxonomyNodes?: Maybe<Array<TaxonomyNode>>;
    title: ScalarsEnums['String'];
    type: ScalarsEnums['TaxonomyType'];
}

export interface TaxonomyNode {
    __typename?: 'TaxonomyNode';
    childrenReferenceIds?: Maybe<Array<ScalarsEnums['String']>>;
    color?: Maybe<ScalarsEnums['String']>;
    description: ScalarsEnums['String'];
    featureTypeReferenceId?: Maybe<ScalarsEnums['String']>;
    parentReferenceId?: Maybe<ScalarsEnums['String']>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    taxon: Taxon;
    title: ScalarsEnums['String'];
}

export interface TaxonomySpecies {
    __typename?: 'TaxonomySpecies';
    species: ScalarsEnums['String'];
    taxonomyId: ScalarsEnums['String'];
}

export interface Technique {
    __typename?: 'Technique';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface TileSource {
    __typename?: 'TileSource';
    annotationSvg?: Maybe<ScalarsEnums['String']>;
    metadataUrl: ScalarsEnums['String'];
    url: ScalarsEnums['String'];
}

export interface TranscriptomicDataSet {
    __typename?: 'TranscriptomicDataSet';
    cellTypeTaxonomy?: Maybe<Array<Maybe<CellTypeTaxonomy>>>;
    defaultCentralMeasure?: Maybe<ScalarsEnums['String']>;
    displayName?: Maybe<ScalarsEnums['String']>;
    downloadFiles?: Maybe<Array<Maybe<DownloadFile>>>;
    downloadPage?: Maybe<ScalarsEnums['String']>;
    features?: Maybe<Array<Maybe<Gene>>>;
    markers?: Maybe<Array<Maybe<Gene>>>;
    modality?: Maybe<Array<Maybe<Modality>>>;
    name?: Maybe<ScalarsEnums['String']>;
    protocolsUrl?: Maybe<ScalarsEnums['String']>;
    tSNEPlots?: Maybe<Array<Maybe<tSNEPlotInfo>>>;
}

export interface TreeDisplayProperty {
    __typename?: 'TreeDisplayProperty';
    featureSet?: Maybe<Array<Maybe<CategoricalDisplayProperty>>>;
    featureType: FeatureType;
    filterOperator?: Maybe<ScalarsEnums['FilterOperator']>;
    isDefault: ScalarsEnums['Boolean'];
    modality?: Maybe<Array<Modality>>;
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    type?: Maybe<ScalarsEnums['FeatureDisplayType']>;
}

export interface TriggerBkpWorkflowResponse {
    __typename?: 'TriggerBkpWorkflowResponse';
    JobStatus?: Maybe<ScalarsEnums['String']>;
    result?: Maybe<ScalarsEnums['String']>;
}

/**
 * Umap visualization type.
 */
export interface Umap {
    __typename?: 'Umap';
    /**
     * The annotations for the Visualization.
     */
    annotations: Array<IAnnotation>;
    /**
     * The colorable features of the Umap.
     */
    color: Array<IColorInfo>;
    createdAt: ScalarsEnums['DateTime'];
    createdBy: ScalarsEnums['String'];
    /**
     * The description of the Visualization.
     */
    description: ScalarsEnums['String'];
    id: ScalarsEnums['UUID'];
    /**
     * The priority order of the Visualization.
     */
    priorityOrder: ScalarsEnums['Int'];
    /**
     * The reference id for the Visualization.
     */
    referenceId: ScalarsEnums['String'];
    /**
     * The short title of the Visualization.
     */
    shortTitle: ScalarsEnums['String'];
    /**
     * The title of the Visualization.
     */
    title: ScalarsEnums['String'];
    updatedAt?: Maybe<ScalarsEnums['DateTime']>;
    updatedBy?: Maybe<ScalarsEnums['String']>;
    /**
     * The url for the Umap.
     */
    url: ScalarsEnums['URL'];
}

export interface UrlResource {
    __typename?: 'UrlResource';
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    referenceId: ScalarsEnums['String'];
    shortTitle: ScalarsEnums['String'];
    title: ScalarsEnums['String'];
    type: ScalarsEnums['String'];
    url: ScalarsEnums['String'];
}

export interface UserQuotaResponse {
    __typename?: 'UserQuotaResponse';
    userQuota?: Maybe<ScalarsEnums['Float']>;
}

export interface WebResourceLink {
    __typename?: 'WebResourceLink';
    iconKey?: Maybe<ScalarsEnums['String']>;
    text?: Maybe<ScalarsEnums['String']>;
    url?: Maybe<ScalarsEnums['String']>;
}

export interface WebResourceLinkArrayDisplayProperty {
    __typename?: 'WebResourceLinkArrayDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<Array<Maybe<WebResourceLink>>>;
}

export interface WebResourceLinkDisplayProperty {
    __typename?: 'WebResourceLinkDisplayProperty';
    metadata?: Maybe<PropertyDisplayNameMetadata>;
    value?: Maybe<WebResourceLink>;
}

export interface WorkflowExecutionStatusResponse {
    __typename?: 'WorkflowExecutionStatusResponse';
    ETA?: Maybe<ScalarsEnums['String']>;
    algorithmStatus?: Maybe<ScalarsEnums['String']>;
    workflowStatus?: Maybe<ScalarsEnums['String']>;
}

export interface WorkflowNames {
    __typename?: 'WorkflowNames';
    isAlgorithmDefaultForRefData?: Maybe<ScalarsEnums['Boolean']>;
    reference?: Maybe<ScalarsEnums['String']>;
    referenceDataDisplayName?: Maybe<ScalarsEnums['String']>;
    workflowDisplayName?: Maybe<ScalarsEnums['String']>;
    workflowName?: Maybe<ScalarsEnums['String']>;
}

export interface Mutation {
    __typename?: 'Mutation';
    _empty?: Maybe<ScalarsEnums['String']>;
    /**
     * mutation to cancel workflow
     */
    cancelWorkflow: (args: { executionID: ScalarsEnums['String'] }) => Maybe<HttpStatusCodeResponse>;
    /**
     * mutation to cancel workflow for anynomous users
     */
    cancelWorkflowAnonymous: (args: {
        executionID: ScalarsEnums['String'];
        uuid: ScalarsEnums['String'];
    }) => Maybe<HttpStatusCodeResponse>;
    deleteDataCollectionProject: (args: {
        referenceId: ScalarsEnums['String'];
        supersededBy?: Maybe<Array<ScalarsEnums['String']>>;
    }) => Maybe<ScalarsEnums['Boolean']>;
    /**
     * mutation to delete mapping result
     */
    deleteMappingResult: (args: { executionID: ScalarsEnums['String'] }) => Maybe<HttpStatusCodeResponse>;
    removeEntityRelationship: (args: { input: Array<EntityRelationshipInput> }) => Maybe<ScalarsEnums['Boolean']>;
    restoreToLKG?: Maybe<ScalarsEnums['Boolean']>;
    updateDataCollectionProjectInventory: (args?: {
        input?: Maybe<Array<Maybe<DataCollectionProjectInput>>>;
    }) => Maybe<Array<Maybe<DataCollectionProject>>>;
    updateProjectDisplayProperty: (args?: {
        input?: Maybe<ProjectDisplayPropertyInput>;
    }) => Maybe<ProjectDisplayProperty>;
    updateSpecimenTypeDisplayProperty: (args: {
        input: SpecimenTypeDisplayPropertyInput;
    }) => Maybe<SpecimenTypeDisplayProperty>;
    updateSpecimens: (args?: {
        input?: Maybe<Array<Maybe<AIO_SpecimenInput>>>;
        /**
         * @defaultValue `true`
         */
        refreshViews?: Maybe<ScalarsEnums['Boolean']>;
    }) => Maybe<Array<Maybe<AIO_Specimen>>>;
}

export interface priorityOrderedObject {
    __typename?:
        | 'AIO_Grant'
        | 'AIO_Protocol'
        | 'Contact'
        | 'DataCollection'
        | 'DataCollectionProject'
        | 'DataContributor'
        | 'DataCreator'
        | 'License'
        | 'Program'
        | 'Publication'
        | 'SpecimenType'
        | 'SubProgram'
        | 'UrlResource';
    priorityOrder?: Maybe<ScalarsEnums['Int']>;
    $on: $priorityOrderedObject;
}

export interface Query {
    __typename?: 'Query';
    _empty?: Maybe<ScalarsEnums['String']>;
    aggregateRowsOnFeatureMatrix: (args?: {
        dataset?: Maybe<ScalarsEnums['String']>;
        features?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
        groupBy?: Maybe<MatrixAggregationCellMetadata>;
        operator?: Maybe<MatrixAggregationOperator>;
        rows?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    }) => Maybe<FeatureMatrixAggregationResult>;
    aio_specimen: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        /**
         * @defaultValue `500`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        /**
         * @defaultValue `0`
         */
        offset?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<Array<Maybe<Sort>>>;
    }) => Maybe<Array<Maybe<AIO_Specimen>>>;
    aio_specimenCounts: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        groupBy?: Maybe<Array<Maybe<ScalarsEnums['groupBy_List_String_pattern_id']>>>;
        sort?: Maybe<Array<Maybe<Sort>>>;
    }) => Maybe<Array<Maybe<AggregationResult>>>;
    aio_specimenFacetedSearchProperties: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
    }) => Maybe<Array<Maybe<AIO_SpecimenFacetedSearchProperty>>>;
    aio_specimenRangeCounts: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        groupBy?: Maybe<RangeGroupBy>;
    }) => Maybe<Array<Maybe<AggregationResult>>>;
    allRowsForFeature: (args?: {
        dataset?: Maybe<ScalarsEnums['String']>;
        feature?: Maybe<ScalarsEnums['String']>;
    }) => Maybe<ScalarsEnums['JSON']>;
    askGPT: (args: { prompt: ScalarsEnums['String'] }) => ScalarsEnums['String'];
    /**
     * queries cell types documents for suggested document matches
     */
    autosuggestCellTypes: (args: {
        limit?: Maybe<ScalarsEnums['Int']>;
        q: ScalarsEnums['String'];
        species?: Maybe<Array<ScalarsEnums['String']>>;
    }) => Maybe<ScalarsEnums['JSON']>;
    /**
     * Gets a list of BkpDatasets.
     */
    bkpDatasets: (args?: {
        /**
         * Returns the elements in the list that come after the specified cursor.
         */
        after?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the elements in the list that come before the specified cursor.
         */
        before?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the first _n_ elements from the list.
         */
        first?: Maybe<ScalarsEnums['Int']>;
        /**
         * Returns the last _n_ elements from the list.
         */
        last?: Maybe<ScalarsEnums['Int']>;
        order?: Maybe<Array<BkpDatasetSortInput>>;
        where?: Maybe<BkpDatasetFilterInput>;
    }) => Maybe<BkpDatasetsConnection>;
    /**
     * Gets counts for cell properties
     */
    cellCounts: (args?: {
        /**
         * Filter for retrieving info in context of dataset.
         */
        datasetFilter?: Maybe<DatasetFilter>;
        /**
         * DEPRECATED: The CellFilter used to filter cell counts.
         */
        filter?: Maybe<Array<CellFilterInput>>;
        /**
         * The CellFilter used to filter cell counts.
         */
        filters?: Maybe<Array<Maybe<[CellFilterInput]>>>;
        /**
         * The columns used to group by.
         */
        groupBy?: Maybe<Array<ScalarsEnums['String']>>;
    }) => Maybe<Array<AggregationResult>>;
    /**
     * Gets a list of CellGenes.
     */
    cellGenes: (args?: {
        /**
         * Returns the elements in the list that come after the specified cursor.
         */
        after?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the elements in the list that come before the specified cursor.
         */
        before?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the first _n_ elements from the list.
         */
        first?: Maybe<ScalarsEnums['Int']>;
        /**
         * Returns the last _n_ elements from the list.
         */
        last?: Maybe<ScalarsEnums['Int']>;
        order?: Maybe<Array<CellGeneSortInput>>;
        where?: Maybe<CellGeneFilterInput>;
    }) => Maybe<CellGenesConnection>;
    /**
     * Gets info of cells
     */
    cellInfo: (args?: {
        /**
         * Filter for retrieving info in context of dataset
         */
        datasetFilter?: Maybe<DatasetFilter>;
        /**
         * DEPRECATED: The CellFilter used to filter cell info.
         */
        filter?: Maybe<Array<CellFilterInput>>;
        /**
         * The CellFilter used to filter cell info.
         */
        filters?: Maybe<Array<Maybe<[CellFilterInput]>>>;
        /**
         * Limit on how many entries to return.
         * @defaultValue `10`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        /**
         * Index used for keyset pagination.
         * @defaultValue `-1`
         */
        prevPageMaxIndex?: Maybe<ScalarsEnums['Int']>;
        /**
         * Feature type reference ids.
         */
        properties?: Maybe<Array<ScalarsEnums['String']>>;
    }) => Maybe<Array<CellInfo>>;
    /**
     * Gets a list of cell properties.
     */
    cellProperties: (args?: {
        /**
         * Returns the elements in the list that come after the specified cursor.
         */
        after?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the elements in the list that come before the specified cursor.
         */
        before?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the first _n_ elements from the list.
         */
        first?: Maybe<ScalarsEnums['Int']>;
        /**
         * Returns the last _n_ elements from the list.
         */
        last?: Maybe<ScalarsEnums['Int']>;
        order?: Maybe<Array<CellPropertySortInput>>;
        where?: Maybe<CellPropertyFilterInput>;
    }) => Maybe<CellPropertiesConnection>;
    /**
     * Gets range counts for gene expressions
     */
    cellRangeCounts: (args: {
        /**
         * Filter for retrieving info in context of dataset.
         */
        datasetFilter?: Maybe<DatasetFilter>;
        /**
         * DEPRECATED: The CellFilter used to filter range counts.
         */
        filter?: Maybe<Array<CellFilterInput>>;
        /**
         * The CellFilter used to filter range counts.
         */
        filters?: Maybe<Array<Maybe<[CellFilterInput]>>>;
        /**
         * The GroupBy used to group data collection.
         */
        groupBy: RangeGroupByInput;
    }) => Maybe<Array<Maybe<AggregationResult>>>;
    dataCollectionProjectFacetedSearchProperties?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    dataCollectionProjectInventory: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        /**
         * @defaultValue `500`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        /**
         * @defaultValue `0`
         */
        offset?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<Array<Maybe<Sort>>>;
    }) => Maybe<Array<Maybe<DataCollectionProject>>>;
    dataCollectionProjectInventoryCounts: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        groupBy?: Maybe<Array<Maybe<ScalarsEnums['groupBy_List_String_pattern_id']>>>;
    }) => Maybe<Array<Maybe<AggregationResult>>>;
    exportSpecimen: (args: {
        bundleType: SpecimenBundleType;
        columns?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
        filters?: Maybe<Array<Maybe<Filter>>>;
        projectReferenceId: ScalarsEnums['String'];
    }) => Maybe<SpecimenExportResult>;
    getABCAtlasDefaults: (args?: {
        dataCollectionIds?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    }) => Maybe<DefaultProjectInfo>;
    /**
     * queries to get uuid for a anonymous user
     */
    getAnonymousUuid: ScalarsEnums['String'];
    /**
     * returns a list of IDs for the available taxonomies in the system
     */
    getAvailableTaxonomies: Array<Maybe<TaxonomySpecies>>;
    /**
     * provides metadata about taxonomy
     * these metadata include details about every node in the taxonomy via the "nodes" property
     * the "nodes" property can also be filtered to a node with the nested "accessionId" parameter
     */
    getCellTypesTaxonomyInfo: (args?: { taxonomyId?: Maybe<ScalarsEnums['String']> }) => Maybe<CellTypeTaxonomyInfo>;
    /**
     * queries data collection projects to display
     */
    getDataCollectionProjectDisplay: (args?: {
        filter?: Maybe<Array<Maybe<BffFilter>>>;
        /**
         * @defaultValue `500`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        /**
         * @defaultValue `0`
         */
        offset?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<Array<Maybe<BffSort>>>;
    }) => Array<Maybe<DataCollectionDisplayProject>>;
    getDisplayProperty: (args: { displayPropertyFilter: DisplayPropertyFilter }) => Maybe<DisplayProperty>;
    getDonorPathologyImageProperties: (args: {
        donorReferenceId: ScalarsEnums['String'];
    }) => Maybe<PathologyImageProperties>;
    getDonorPathologyImageSet: (args: {
        donorReferenceId: ScalarsEnums['String'];
        region: ScalarsEnums['String'];
        slide: ScalarsEnums['String'];
    }) => Maybe<Array<PathologyImage>>;
    getFeaturesInDataSet: (args: {
        DataSet: ScalarsEnums['String'];
        features: Array<Maybe<ScalarsEnums['String']>>;
        /**
         * @defaultValue `10`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
    }) => Maybe<Array<Maybe<Gene>>>;
    /**
     * queries data collection project faceted search properties and includes a display name
     */
    getFilterField?: Maybe<Array<Maybe<FilterField>>>;
    /**
     * queries data collection project inventory counts and returns a list of items with counts for a groupBy category
     */
    getItemCount: (args?: {
        filter?: Maybe<Array<Maybe<BffFilter>>>;
        groupBy?: Maybe<ScalarsEnums['String']>;
        sort?: Maybe<BffSort>;
    }) => Maybe<Array<Maybe<ItemCount>>>;
    /**
     * queries to get all mapping results for a user
     */
    getMappingResults?: Maybe<Array<Maybe<MappingResult>>>;
    getProjectCVImageProperties: (args: { projectReferenceId: ScalarsEnums['String'] }) => Maybe<CVProperties>;
    getProjectCVImageSet: (args?: { input?: Maybe<CVImagePropertyInput> }) => Maybe<Array<Maybe<CVImage>>>;
    /**
     * Query default display options for a specimen collection
     * Returns null if no collection is found with the given filter input arg
     */
    getSpecimenViewDefaultOptions: (args: { filter: Array<BffFilter> }) => Maybe<SpecimenViewDefaultOptions>;
    getTSNEData: (args?: { TSNEName?: Maybe<ScalarsEnums['String']> }) => Maybe<ScalarsEnums['ByteArray']>;
    getTranscriptomicDataSet: (args?: { DataSet?: Maybe<ScalarsEnums['String']> }) => Maybe<TranscriptomicDataSet>;
    /**
     * queries to get qouta for a user
     */
    getUserQuota?: Maybe<UserQuotaResponse>;
    /**
     * queries all mapping workflow names
     */
    getWorkflowNames?: Maybe<Array<Maybe<WorkflowNames>>>;
    /**
     * queries to find the workflow staus by execution id for authenticated users
     */
    getWorkflowStatus: (args: { executionID: ScalarsEnums['String'] }) => Maybe<WorkflowExecutionStatusResponse>;
    /**
     * queries to find the workflow staus by execution id for anonymous users
     */
    getWorkflowStatusAnonymous: (args: {
        executionID: ScalarsEnums['String'];
        uuid: ScalarsEnums['String'];
    }) => Maybe<WorkflowExecutionStatusResponse>;
    /**
     * queries to initiate download file
     */
    initializeDownload: (args: { executionID: ScalarsEnums['String'] }) => Maybe<InitializeDownloadResponse>;
    /**
     * queries to initiate download file for anonymous users
     */
    initializeDownloadAnonymous: (args: {
        executionID: ScalarsEnums['String'];
        uuid: ScalarsEnums['String'];
    }) => Maybe<InitializeDownloadResponse>;
    /**
     * queries to initiate upload file
     */
    initializeUpload: (args: {
        fileName: ScalarsEnums['String'];
        fileSize: ScalarsEnums['String'];
    }) => Maybe<InitializeUploadResponse>;
    /**
     * queries to initiate upload file for anonymous users
     */
    initializeUploadAnonymous: (args: {
        fileName: ScalarsEnums['String'];
        fileSize: ScalarsEnums['String'];
        uuid: ScalarsEnums['String'];
    }) => Maybe<InitializeUploadResponse>;
    listTranscriptomicDataSets?: Maybe<Array<Maybe<TranscriptomicDataSet>>>;
    /**
     * Gets a list of numeric properties.
     */
    numericProperties: (args?: {
        /**
         * Returns the elements in the list that come after the specified cursor.
         */
        after?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the elements in the list that come before the specified cursor.
         */
        before?: Maybe<ScalarsEnums['String']>;
        /**
         * Returns the first _n_ elements from the list.
         */
        first?: Maybe<ScalarsEnums['Int']>;
        /**
         * Returns the last _n_ elements from the list.
         */
        last?: Maybe<ScalarsEnums['Int']>;
        order?: Maybe<Array<NumericPropertySortInput>>;
        where?: Maybe<NumericPropertyFilterInput>;
    }) => Maybe<NumericPropertiesConnection>;
    /**
     * queries cell types documents for full document matches
     */
    searchCellTypes: (args: {
        limit?: Maybe<ScalarsEnums['Int']>;
        q: ScalarsEnums['String'];
        species?: Maybe<Array<ScalarsEnums['String']>>;
    }) => Maybe<ScalarsEnums['JSON']>;
    searchFeaturesInDataSet: (args: {
        DataSet: ScalarsEnums['String'];
        exact?: Maybe<ScalarsEnums['Boolean']>;
        /**
         * @defaultValue `10`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<Array<Maybe<Sort>>>;
        text: ScalarsEnums['String'];
    }) => Maybe<Array<Maybe<Gene>>>;
    specimen: (args?: {
        filter?: Maybe<Array<Maybe<Filter>>>;
        /**
         * @defaultValue `500`
         */
        limit?: Maybe<ScalarsEnums['Int']>;
        /**
         * @defaultValue `0`
         */
        offset?: Maybe<ScalarsEnums['Int']>;
        sort?: Maybe<Array<Maybe<Sort>>>;
    }) => Maybe<Array<Maybe<Specimen>>>;
    specimenAggregate: (args?: {
        aggregationOperation?: Maybe<AggregationOperation>;
        filter?: Maybe<Array<Maybe<Filter>>>;
        groupBy?: Maybe<Array<Maybe<ScalarsEnums['groupBy_List_String_pattern_id']>>>;
        sort?: Maybe<Array<Maybe<Sort>>>;
    }) => Maybe<Array<Maybe<AggregationResult>>>;
    specimenFacetedSearchProperties?: Maybe<Array<Maybe<ScalarsEnums['String']>>>;
    /**
     * queries to trigger workflow
     */
    triggerBkpWorkflow: (args: {
        executionID: ScalarsEnums['String'];
        referenceTaxonomies: Array<Maybe<ScalarsEnums['String']>>;
        workflowNames: Array<Maybe<ScalarsEnums['String']>>;
    }) => Maybe<TriggerBkpWorkflowResponse>;
    /**
     * queries to trigger workflow for anonymous users
     */
    triggerBkpWorkflowAnonymous: (args: {
        email?: Maybe<ScalarsEnums['String']>;
        executionID: ScalarsEnums['String'];
        referenceTaxonomies: Array<Maybe<ScalarsEnums['String']>>;
        uuid: ScalarsEnums['String'];
        workflowNames: Array<Maybe<ScalarsEnums['String']>>;
    }) => Maybe<TriggerBkpWorkflowResponse>;
}

export interface Subscription {
    __typename?: 'Subscription';
}

export interface tSNEPlotInfo {
    __typename?: 'tSNEPlotInfo';
    name?: Maybe<ScalarsEnums['String']>;
}

export interface $AIO_Project {
    DataCollectionProject?: DataCollectionProject;
    Program?: Program;
    SubProgram?: SubProgram;
}

export interface $DataSet {
    TranscriptomicDataSet?: TranscriptomicDataSet;
}

export interface $DisplayProperty {
    DatasetDisplayProperty?: DatasetDisplayProperty;
    ProjectDisplayProperty?: ProjectDisplayProperty;
    SpecimenTypeDisplayProperty?: SpecimenTypeDisplayProperty;
}

export interface $FeatureDisplayProperty {
    AnnotationDisplayProperty?: AnnotationDisplayProperty;
    CategoricalDisplayProperty?: CategoricalDisplayProperty;
    ImageDisplayProperty?: ImageDisplayProperty;
    MeasurementDisplayProperty?: MeasurementDisplayProperty;
    NumericDisplayProperty?: NumericDisplayProperty;
    TreeDisplayProperty?: TreeDisplayProperty;
}

export interface $IAnnotation {
    SvgAnnotation?: SvgAnnotation;
}

export interface $IColorInfo {
    ColorSetInfo?: ColorSetInfo;
}

export interface $IDataset {
    BkpDataset?: BkpDataset;
}

export interface $IGene {
    CellGene?: CellGene;
}

export interface $INumericColor {
    ColorGradient?: ColorGradient;
    ColorMap?: ColorMap;
}

export interface $IProperty {
    CellProperty?: CellProperty;
}

export interface $IVisualization {
    CoronalGrid?: CoronalGrid;
    DynamicGrid?: DynamicGrid;
    Umap?: Umap;
}

export interface $priorityOrderedObject {
    AIO_Grant?: AIO_Grant;
    AIO_Protocol?: AIO_Protocol;
    Contact?: Contact;
    DataCollection?: DataCollection;
    DataCollectionProject?: DataCollectionProject;
    DataContributor?: DataContributor;
    DataCreator?: DataCreator;
    License?: License;
    Program?: Program;
    Publication?: Publication;
    SpecimenType?: SpecimenType;
    SubProgram?: SubProgram;
    UrlResource?: UrlResource;
}

export interface GeneratedSchema {
    query: Query;
    mutation: Mutation;
    subscription: Subscription;
}

export type ScalarsEnums = {
    [Key in keyof Scalars]: Scalars[Key] extends { output: unknown } ? Scalars[Key]['output'] : never;
} & {
    AIO_SpecimenFacetedSearchPropertyType: AIO_SpecimenFacetedSearchPropertyType;
    AggregationOperator: AggregationOperator;
    AnnotationType: AnnotationType;
    BffFilterOperator: BffFilterOperator;
    BffSortOrder: BffSortOrder;
    CacheControlScope: CacheControlScope;
    CellFilterType: CellFilterType;
    ColorType: ColorType;
    DisplayPropertyType: DisplayPropertyType;
    EntityType: EntityType;
    ExportStatus: ExportStatus;
    FeatureDisplayType: FeatureDisplayType;
    FilterOperator: FilterOperator;
    MatrixAggregationCellMetadata: MatrixAggregationCellMetadata;
    MatrixAggregationOperator: MatrixAggregationOperator;
    MeasurementType: MeasurementType;
    NullDisplayOption: NullDisplayOption;
    ProjectCapabilities: ProjectCapabilities;
    SortOrder: SortOrder;
    SpecimenBundleType: SpecimenBundleType;
    SpecimenRelationship: SpecimenRelationship;
    SpecimenRelationshipInputType: SpecimenRelationshipInputType;
    SpecimensViewTitle: SpecimensViewTitle;
    TaxonomyType: TaxonomyType;
    TypeState: TypeState;
};
