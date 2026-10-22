{{- define "planer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "planer.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "planer.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "planer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "planer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "planer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "planer.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) -}}
{{- end -}}

{{- define "planer.postgresName" -}}
{{- printf "%s-postgresql" (include "planer.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "planer.postgresSecretName" -}}
{{- default (include "planer.postgresName" .) .Values.postgresql.auth.existingSecret -}}
{{- end -}}

{{- define "planer.databaseSecretName" -}}
{{- if .Values.database.url -}}
{{- printf "%s-database" (include "planer.fullname" .) -}}
{{- else -}}
{{- .Values.database.existingSecret -}}
{{- end -}}
{{- end -}}

{{/* Env z DATABASE_URL — wspólny dla aplikacji i CronJoba backupu. */}}
{{- define "planer.databaseEnv" -}}
{{- if .Values.postgresql.enabled }}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "planer.postgresSecretName" . }}
      key: {{ .Values.postgresql.auth.passwordKey }}
- name: DATABASE_URL
  value: {{ printf "postgresql://%s:$(POSTGRES_PASSWORD)@%s:5432/%s" .Values.postgresql.user (include "planer.postgresName" .) .Values.postgresql.database | quote }}
{{- else }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "planer.databaseSecretName" . }}
      key: {{ if .Values.database.url }}DATABASE_URL{{ else }}{{ .Values.database.secretKey }}{{ end }}
{{- end }}
{{- end -}}
