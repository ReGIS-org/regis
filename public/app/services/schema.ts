module App {
    export interface IAngularFormItem {
        [key: string]: any;
        key: string;
        type?: string;
        items?: IAngularFormItem[];
    }
    export interface IJsonSchema {
        type?: string;
        properties?: any;
        form?: IAngularForm;
        default?: any;
        [key: string]: any;
    }
    export interface IAngularForm extends Array<IAngularFormItem> {
    }
    export interface ICustomTypeParser {
        (IAngularFormItem, IJsonSchema, IAngularForm): void;
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
            var newSchema: IJsonSchema = {
                type: 'object',
                properties: data.properties
            };
            var newForm: IAngularForm = [];
            data.form.forEach((item: IAngularFormItem) => {
                this.applyRulesForItem(item, newSchema, newForm, customTypeParsers);
            });

            return {
                schema: newSchema,
                form: newForm
            };
        }

        private applyRulesForItem(formItem: IAngularFormItem, schema: IJsonSchema, form: IAngularForm, customTypeParsers: StringMap<ICustomTypeParser>) {
            var formRules: StringMap<ICustomTypeParser> = {
                type: (formItem, schemaItem, form) => {
                    var paramType: string = formItem.type;
                    if (paramType in customTypeParsers) {
                        customTypeParsers[paramType](formItem, schemaItem, form);
                    } else {
                        this.$log.debug('SchemaService: no mapping known for type: ' + paramType);
                        schema.type = paramType;
                    }
                },
                items: (formItem, schemaItem, _form) => {
                    var newItems = [];
                    formItem.items.forEach(function (item) {
                        this.applyRulesForItem(item, schemaItem.items, newItems, customTypeParsers);
                    });
                    formItem.items = newItems;
                },
                default: (formItem, schema, _form) => {
                    if (formItem.type === 'number') {
                        schema.default = Number(formItem.default);
                    }
                }
            };

            var schemaRules: StringMap<ICustomTypeParser> = {
                minItems: (formItem, schemaItem, _form) => {
                    var key = formItem.key;
                    var minimum = schemaItem.minItems;
                    formItem.ngModel = function (ngModel) {
                        ngModel.$validators[key] = function (value) {
                            if (value && value.length) {
                                return value.length >= minimum;
                            } else {
                                return false;
                            }
                        };
                    };
                },
                maxItems: function (formItem, schemaItem, _form) {
                    var key = formItem.key;
                    var maximum = schemaItem.minItems;
                    formItem.ngModel = function (ngModel) {
                        ngModel.$validators[key] = function (value) {
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
                if ('key' in formItem) {
                    name = formItem.key;
                    schemaItem = schema.properties[name];
                } else {
                    name = undefined;
                    schemaItem = undefined;
                }

                for (var key in formItem) {
                    if (formItem.hasOwnProperty(key) && key !== 'type' && key in formRules) {
                        var rule = formRules[key];
                        rule(formItem, schemaItem, form);
                    } else {
                        this.$log.debug('SchemaService: no rule know for key: ' + key);
                    }
                }
                for (key in schemaItem) {
                    if (schemaItem.hasOwnProperty(key) && key !== 'type' && key in schemaRules) {
                        var schemaRule = schemaRules[key];
                        schemaRule(formItem, schemaItem, form);
                    } else {
                        this.$log.debug('SchemaService: no rule know for key: ' + key);
                    }
                }
                var typeAttribute = 'type';
                // Perform type handlers last so they can use the other values
                if (typeAttribute in formItem) {
                    var typeRule = formRules[typeAttribute];
                    typeRule(formItem, schemaItem, form);
                }
            }

            if (angular.isDefined(schemaItem)) {
                schema.properties[name] = schemaItem;
            }
            form.push(formItem);
        }
    }

    angular
        .module('csWebApp')
        .service('SchemaService', SchemaService);
}
