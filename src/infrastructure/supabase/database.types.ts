
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "jugadores": {
                  Row: {
                    "creado_en": string,"id": string,"nombre": string,"puntaje": number,"racha": number,"racha_max": number,"sala": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"id": string,"nombre": string,"puntaje"?: number,"racha"?: number,"racha_max"?: number,"sala": string
                  }
                  Update: {
                    "creado_en"?: string,"id"?: string,"nombre"?: string,"puntaje"?: number,"racha"?: number,"racha_max"?: number,"sala"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jugadores_sala_fkey"
      columns: ["sala"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    }
                  ]
                },"preguntas": {
                  Row: {
                    "id": string,"opciones": NonNullable<Json>,"posicion": number,"sala": string,"texto": string,"tipo_minijuego": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"opciones": NonNullable<Json>,"posicion": number,"sala": string,"texto": string,"tipo_minijuego": string,"titulo": string
                  }
                  Update: {
                    "id"?: string,"opciones"?: NonNullable<Json>,"posicion"?: number,"sala"?: string,"texto"?: string,"tipo_minijuego"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "preguntas_sala_fkey"
      columns: ["sala"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    }
                  ]
                },"respuestas": {
                  Row: {
                    "jugador": string,"opcion": number,"recibida_en": string,"ronda": number,"sala": string
                  }
                  ComputedFields: never
                  Insert: {
                    "jugador": string,"opcion": number,"recibida_en"?: string,"ronda": number,"sala": string
                  }
                  Update: {
                    "jugador"?: string,"opcion"?: number,"recibida_en"?: string,"ronda"?: number,"sala"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "respuestas_jugador_fkey"
      columns: ["jugador"]
isOneToOne: false
      referencedRelation: "jugadores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "respuestas_sala_fkey"
      columns: ["sala"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    }
                  ]
                },"respuestas_correctas": {
                  Row: {
                    "indice_correcto": number,"posicion": number,"sala": string
                  }
                  ComputedFields: never
                  Insert: {
                    "indice_correcto": number,"posicion": number,"sala": string
                  }
                  Update: {
                    "indice_correcto"?: number,"posicion"?: number,"sala"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "respuestas_correctas_sala_fkey"
      columns: ["sala"]
isOneToOne: false
      referencedRelation: "salas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "respuestas_correctas_sala_posicion_fkey"
      columns: ["sala","posicion"]
isOneToOne: true
      referencedRelation: "preguntas"
      referencedColumns: ["sala","posicion"]
    }
                  ]
                },"salas": {
                  Row: {
                    "admin_id": string,"codigo": string,"creada_en": string,"duracion_seg": number,"estado": string,"fin_ronda": string | null,"id": string,"inicio_ronda": string | null,"numero_sesion": number,"ronda_actual": number
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id": string,"codigo": string,"creada_en"?: string,"duracion_seg"?: number,"estado"?: string,"fin_ronda"?: string | null,"id"?: string,"inicio_ronda"?: string | null,"numero_sesion"?: number,"ronda_actual"?: number
                  }
                  Update: {
                    "admin_id"?: string,"codigo"?: string,"creada_en"?: string,"duracion_seg"?: number,"estado"?: string,"fin_ronda"?: string | null,"id"?: string,"inicio_ronda"?: string | null,"numero_sesion"?: number,"ronda_actual"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ajustar_duracion":
{ Args: { "p_duracion_seg": number,"p_sala": string }; Returns: Json
                           },
"anular_respuesta":
{ Args: { "p_ronda": number,"p_sala": string }; Returns: undefined
                           },
"avanzar_ronda":
{ Args: { "p_sala": string }; Returns: Json
                           },
"contar_respondidos":
{ Args: { "p_ronda": number,"p_sala": string }; Returns: number
                           },
"crear_sala":
{ Args: { "p_duracion_seg"?: number }; Returns: Json
                           },
"enviar_respuesta":
{ Args: { "p_opcion": number,"p_ronda": number,"p_sala": string }; Returns: Json
                           },
"es_admin_sala":
{ Args: { "p_sala": string }; Returns: boolean
                           },
"es_anonimo":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_jugador_sala":
{ Args: { "p_sala": string }; Returns: boolean
                           },
"es_miembro_sala":
{ Args: { "p_sala": string }; Returns: boolean
                           },
"expulsar_jugador":
{ Args: { "p_jugador": string,"p_sala": string }; Returns: undefined
                           },
"generar_codigo_sala":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"guardar_preguntas":
{ Args: { "p_preguntas": Json,"p_sala": string }; Returns: undefined
                           },
"hora_servidor":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"iniciar_ronda":
{ Args: { "p_sala": string }; Returns: Json
                           },
"insertar_preguntas_por_defecto":
{ Args: { "p_sala": string }; Returns: undefined
                           },
"normalizar_nombre":
{ Args: { "p_nombre": string }; Returns: string
                           },
"obtener_correcta_revelada":
{ Args: { "p_sala": string }; Returns: number
                           },
"obtener_preguntas_admin":
{ Args: { "p_sala": string }; Returns: Json
                           },
"obtener_sala_admin_bloqueada":
{ Args: { "p_sala": string }; Returns: {
              "admin_id": string,
"codigo": string,
"creada_en": string,
"duracion_seg": number,
"estado": string,
"fin_ronda": string | null,
"id": string,
"inicio_ronda": string | null,
"numero_sesion": number,
"ronda_actual": number
            }
                          SetofOptions: {
        from: "*"
        to: "salas"
        isOneToOne: true
        isSetofReturn: false
      } },
"purgar_sala":
{ Args: { "p_sala": string }; Returns: undefined
                           },
"reiniciar_sala":
{ Args: { "p_sala": string }; Returns: Json
                           },
"revelar_ronda":
{ Args: { "p_sala": string }; Returns: Json
                           },
"salir_de_sala":
{ Args: { "p_sala": string }; Returns: undefined
                           },
"unirse_a_sala":
{ Args: { "p_codigo": string,"p_nombre": string }; Returns: Json
                           },
"validar_preguntas":
{ Args: { "p_preguntas": Json }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
