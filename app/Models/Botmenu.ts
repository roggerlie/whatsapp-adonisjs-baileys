import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Botmenu extends BaseModel {

  public static table = 'botmenu'

  @column({ isPrimary: true })
  public id: number

  @column()
  public command: string

  @column()
  public info: string

  @column({columnName: 'isAskDB'})
  public isaskdb: string

  @column({columnName: 'isImage'})
  public isimage: string

  @column()
  public reply: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
