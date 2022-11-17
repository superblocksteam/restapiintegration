import {
  DatasourceMetadataDto,
  ExecutionOutput,
  IntegrationError,
  paramHasKeyValue,
  Property,
  RawRequest,
  RestApiIntegrationActionConfiguration,
  RestApiIntegrationDatasourceConfiguration,
  REST_API_DEFAULT_USER_AGENT
} from '@superblocksteam/shared';
import { RestApiFields, makeCurlString } from '@superblocksteam/shared';
import { ApiPlugin, PluginExecutionProps, updateRequestBody } from '@superblocksteam/shared-backend';
import { AxiosRequestConfig, Method } from 'axios';

export default class RestApiIntegrationPlugin extends ApiPlugin {
  async execute({
    context,
    datasourceConfiguration,
    actionConfiguration
  }: PluginExecutionProps<RestApiIntegrationDatasourceConfiguration>): Promise<ExecutionOutput> {
    let url: URL;
    let headers = {};

    if (!actionConfiguration.httpMethod) {
      throw new IntegrationError('No HTTP method specified for REST API step');
    }

    try {
      url = new URL(`${datasourceConfiguration.urlBase}${actionConfiguration.urlPath ?? ''}`);
    } catch (err) {
      throw new IntegrationError(`URL is not valid, ${err.message}`);
    }

    const params = (datasourceConfiguration.params ?? []).concat(actionConfiguration.params ?? []);
    if (params) {
      params.filter(paramHasKeyValue).forEach((param) => {
        url.searchParams.append(param.key, param.value);
      });
    }

    try {
      const headerList = (datasourceConfiguration.headers ?? []).concat(actionConfiguration.headers ?? []);
      if (headerList) {
        headers = headerList.reduce<Record<string, unknown>>((o: Record<string, unknown>, p: Property, _i: number, _ps: Property[]) => {
          if (!p || !p?.key) return o;
          o[p.key] = p?.value;
          return o;
        }, {});
      }
    } catch (err) {
      throw new IntegrationError(`Headers failed to transform, ${err.message}`);
    }

    if (
      !Object.keys(headers).some((k) => {
        return 'user-agent' === k.toLowerCase();
      })
    ) {
      headers['User-Agent'] = REST_API_DEFAULT_USER_AGENT;
    }

    // TODO: Refactor and reuse the generateRequestConfig function from ApiPlugin
    const options: AxiosRequestConfig = {
      url: url.toString(),
      // request arraybuffer and let extractResponseData figure out the correct data type for the response body
      responseType: 'arraybuffer',
      method: actionConfiguration.httpMethod.toString() as Method,
      headers: headers,
      timeout: this.pluginConfiguration.restApiExecutionTimeoutMs,
      maxBodyLength: this.pluginConfiguration.restApiMaxContentLengthBytes,
      maxContentLength: this.pluginConfiguration.restApiMaxContentLengthBytes
    };

    updateRequestBody({
      actionConfiguration: actionConfiguration,
      headers: headers,
      options: options
    });

    return await this.executeRequest(options, actionConfiguration.responseType);
  }

  getRequest(
    actionConfiguration: RestApiIntegrationActionConfiguration,
    datasourceConfiguration: RestApiIntegrationDatasourceConfiguration
  ): RawRequest {
    if (!actionConfiguration.httpMethod) {
      throw new IntegrationError(`HTTP method not specified`);
    }
    const httpMethod = actionConfiguration.httpMethod;
    const url = `${datasourceConfiguration.urlBase}${actionConfiguration.urlPath ?? ''}`;
    const headers = (datasourceConfiguration.headers ?? []).concat(actionConfiguration.headers ?? []);
    const params = (datasourceConfiguration.params ?? []).concat(actionConfiguration.params ?? []);
    const bodyType = actionConfiguration.bodyType;
    const body = actionConfiguration.body;
    const formData = actionConfiguration.formData;
    const fileName = actionConfiguration.fileName;
    const fileFormKey = actionConfiguration.fileFormKey;

    return makeCurlString({
      reqMethod: httpMethod,
      reqUrl: url,
      reqHeaders: headers,
      reqParams: params,
      reqBody: body,
      reqFormData: formData,
      reqBodyType: bodyType,
      reqFileName: fileName,
      reqFileFormKey: fileFormKey
    });
  }

  dynamicProperties(): string[] {
    return [
      RestApiFields.URL_BASE,
      RestApiFields.URL_PATH,
      RestApiFields.PARAMS,
      RestApiFields.HEADERS,
      RestApiFields.BODY_TYPE,
      RestApiFields.BODY,
      RestApiFields.FORM_DATA,
      RestApiFields.FILE_NAME,
      RestApiFields.FILE_FORM_KEY
    ];
  }

  escapeStringProperties(): string[] {
    return [RestApiFields.BODY];
  }

  async metadata(datasourceConfiguration: RestApiIntegrationDatasourceConfiguration): Promise<DatasourceMetadataDto> {
    return {};
  }

  async test(datasourceConfiguration: RestApiIntegrationDatasourceConfiguration): Promise<void> {
    return;
  }
}
