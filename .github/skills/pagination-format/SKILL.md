---
name: pagination-format
user-invocable: false
description: "用于创建或修改列表/分页 API、service 方法、响应 DTO 时参考（InnerUp 适配）；分页数据放在响应 data 内，格式固定为 page、pageSize、total，page 默认从 1 表示第一页。"
---

# 分页返回格式

## 本项目适配（InnerUp）

- 这里的 `pagination` 是**响应 `data` 里的字段**；外层 `{ code, data, message }` 由
  `TransformInterceptor` 统一包装，service / controller **不要自己拼外壳**
- 分页入参 DTO 放模块的 `dto/` 目录（`*.dto.ts`），用 `class-validator` + `@ApiProperty`
- 列表查询必须带 `where: { userId }` 做用户隔离
- 期望结构：`data = { records, pagination: { page, pageSize, total } }`
- 本项目目前还没有分页接口；M3 目标/任务列表是第一个落点

## 规则

创建或修改任何返回分页数据的 API/service 方法时，返回的 `pagination` 对象必须使用下面固定字段结构和值来源：

```typescript
pagination: {
  page: pagination.page,
  pageSize: pagination.pageSize,
  total: total,
}
```

## 要求

- 返回的分页字段中不要重命名 `page` 或 `pageSize`。
- 除非已有外部接口契约明确要求，否则不要返回 `current`、`limit`、`perPage`、`size`、`count`、`totalCount` 等替代字段。
- 优先使用本地 `pagination` 参数/对象作为 `page` 和 `pageSize` 的来源。
- 优先使用本地 `total` 变量作为 `total` 的来源。
- 字段顺序保持为 `page`、`pageSize`、`total`。
- 编写分页入参、DTO、默认值或接口示例时，`page` 默认传 `1`，表示第一页。
- 计算分页偏移量时，按第一页为 `page = 1` 处理，例如 `skip = pageSize * (page - 1)`。

## 示例

```typescript
return {
  records,
  pagination: {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: total,
  },
};
```

## 分页入参示例

```typescript
const pagination = {
  page: body.page || 1,
  pageSize: body.pageSize,
};
```
