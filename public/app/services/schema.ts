module App {

    export type IAngularFormItem = IAngularFormSpec | string;

    /** Form item as specified in Angular-Schema-Form */
    export interface IAngularFormSpec {
        [key: string]: any;
        key: string;
        type?: string;
        items?: IAngularFormItem[];
    }
    export interface IAngularForm extends Array<IAngularFormItem> {
    }

    export interface IJsonSchema {
        type?: string;
        properties?: any;
        form?: IAngularForm;
        default?: any;
        items?: IJsonSchema;
        [key: string]: any;
    }
    export interface ICustomTypeParser {
        (IAngularFormSpec, IJsonSchema): void;
    }

    export interface StringMap<ValueType> {
        [key: string]: ValueType;
    }

    export class SchemaService {
        public static $inject = ['$http', '$log'];

        constructor(private $http: ng.IHttpService, private $log: ng.ILogService) {}

        public getSchema(webserviceURL: string, simulation: string, version: string, customTypeParsers: StringMap<ICustomTypeParser>): ng.IPromise<{schema: IJsonSchema, form: IAngularForm}> {
            return this.$http.get(webserviceURL + '/simulate/' + simulation + '/' + version).then(response => {
                return this.parseSchema(response.data, customTypeParsers);
            });
        }

        private parseSchema(data: IJsonSchema, customTypeParsers: StringMap<ICustomTypeParser>): {schema: IJsonSchema, form: IAngularForm} {
            // Transform Resource object to JSON
            let newSchema: IJsonSchema = {
                type: 'object',
                properties: data.properties
            };
            data.form.forEach(item => this.applyRulesForItem(item, newSchema, customTypeParsers));

            return {
                schema: newSchema,
                form: data.form
            };
        }

        private applyRulesForItem(formItem: IAngularFormItem, schema: IJsonSchema, customTypeParsers: StringMap<ICustomTypeParser>) {
            let formRules: StringMap<ICustomTypeParser> = {
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

            let schemaRules: StringMap<ICustomTypeParser> = {
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
                let formSpec = <IAngularFormSpec> formItem;
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
                    let typeRule = formRules[typeAttribute];
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
