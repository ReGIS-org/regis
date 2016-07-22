module App {
    /** Form item as specified in Angular-Schema-Form */
    export interface IAngularFormSpec {
        [key: string]: any;
        key: string;
        type?: string;
        items?: IAngularFormItem[];
    }
    /** Form item can also just be a key name */
    export type IAngularFormItem = IAngularFormSpec | string;
    export interface IAngularForm extends Array<IAngularFormItem> {
    }

    /** JSON Schema. In our service, this can also have a form property for a Angular Schema Form. */
    export interface IJsonSchema {
        type?: string;
        properties?: any;
        form?: IAngularForm;
        default?: any;
        items?: IJsonSchema;
        [key: string]: any;
    }
    /** Parsing function for forms and schemas that modifies the form items and schemas in place. */
    export interface ICustomTypeParser {
        (IAngularFormSpec, IJsonSchema): void;
    }
    /** Simple map of given type. */
    export interface StringMap<ValueType> {
        [key: string]: ValueType;
    }
    /** Service for retrieving a JSON Schema from the SIM-CITY web service
     *
     * The web service serves the schema with an Angular Schema Form.
     */
    export class SchemaService {
        public static $inject = ['SimAdminService', '$http', '$log'];

        constructor(private SimAdminService: App.SimAdminService,
                    private $http: ng.IHttpService,
                    private $log: ng.ILogService) {

        }

        /**
         * Get the schema of given simulation with given version from the given webservice URL.
         * Pass custom form and schema parsers to modify the form or schema in-place. The key of the custom parser
         * is taken as the type parameter of the schema and form items.
         */
        public getSchema(customTypeParsers: StringMap<ICustomTypeParser> = {}): ng.IPromise<{schema: IJsonSchema, form: IAngularForm}> {
            return this.$http.get(this.SimAdminService.webserviceUrl + '/simulate/' +
                                  this.SimAdminService.simulationName + '/' +
                                  this.SimAdminService.simulationVersion).then(
                (response: ng.IHttpPromiseCallbackArg<IJsonSchema>) => {
                    // Transform Resource object to JSON
                    var newSchema: IJsonSchema = {
                        type: 'object',
                        properties: response.data.properties
                    };

                    if (response.data.hasOwnProperty('form')) {
                        response.data.form.forEach(item => this.applyRulesForItem(item, newSchema, customTypeParsers));
                    } else {
                        console.error('Schema: no form defined in the response');
                        return null;
                    }

                    return {
                        schema: newSchema,
                        form: response.data.form
                    };
                });
        }

        /**
         * Apply custom type parsers and internal type parsers to the form and schema.
         * It is invoked recursively.
         */
        private applyRulesForItem(formItem: IAngularFormItem, schema: IJsonSchema, customTypeParsers: StringMap<ICustomTypeParser>) {
            var formRules: StringMap<ICustomTypeParser> = {
                type: (formItem, schemaItem) => {
                    var paramType: string = formItem.type;
                    if (paramType in customTypeParsers) {
                        customTypeParsers[paramType](formItem, schemaItem);
                    } else {
                        this.$log.debug('SchemaService: no mapping known for type: ' + paramType);
                        schema.type = paramType;
                    }
                },
                items: (formItem, schemaItem) => {
                    formItem.items
                        .forEach(item => this.applyRulesForItem(item, schemaItem.items, customTypeParsers));
                },
                'default': (formItem, schema) => {
                    if (formItem.type === 'number') {
                        schema['default'] = Number(formItem.default);
                    }
                }
            };

            var schemaRules: StringMap<ICustomTypeParser> = {
                minItems: (formItem, schemaItem) => {
                    var key = formItem.key;
                    var minimum = schemaItem.minItems;
                    formItem.ngModel = (ngModel: ng.INgModelController) => {
                        ngModel.$validators[key] = value => {
                            if (value && value.length) {
                                return value.length >= minimum;
                            } else {
                                return false;
                            }
                        };
                    };
                },
                maxItems: (formItem, schemaItem) => {
                    var key = formItem.key;
                    var maximum = schemaItem.minItems;
                    formItem.ngModel = (ngModel: ng.INgModelController) => {
                        ngModel.$validators[key] = value => {
                            if (value && value.length) {
                                return value.length <= maximum;
                            } else {
                                return false;
                            }
                        };
                    };
                }
            };

            var name;
            var schemaItem;
            if (angular.isString(formItem)) {
                name = formItem;
                schemaItem = schema.properties[name];
            } else {
                var formSpec = <IAngularFormSpec> formItem;
                if ('key' in formSpec) {
                    name = formSpec.key;
                    schemaItem = schema.properties[name];
                } else {
                    name = undefined;
                    schemaItem = undefined;
                }

                for (var key in formSpec) {
                    if (formSpec.hasOwnProperty(key) && key !== 'type' && key in formRules) {
                        formRules[key](formSpec, schemaItem);
                    } else {
                        this.$log.debug('SchemaService: no rule know for key: ' + key);
                    }
                }
                for (key in schemaItem) {
                    if (schemaItem.hasOwnProperty(key) && key !== 'type' && key in schemaRules) {
                        schemaRules[key](formSpec, schemaItem);
                    } else {
                        this.$log.debug('SchemaService: no rule know for key: ' + key);
                    }
                }
                var typeAttribute = 'type';
                // Perform type handlers last so they can use the other values
                if (typeAttribute in formSpec) {
                    var typeRule = formRules[typeAttribute];
                    typeRule(formSpec, schemaItem);
                }
            }

            if (angular.isDefined(schemaItem)) {
                schema.properties[name] = schemaItem;
            }
        }
    }

    angular
        .module('csWebApp')
        .service('SchemaService', SchemaService);
}
