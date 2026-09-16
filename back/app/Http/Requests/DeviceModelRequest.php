<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceModelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');

        return [
            'name'         => ($isUpdate ? 'sometimes' : 'required') . '|string|max:255',
            'mcu'          => 'nullable|string|max:100',
            'ota_capable'  => 'nullable|boolean',
            'manufacturer' => 'nullable|string|max:255',
            'min_firmware' => 'nullable|string|max:50',
            'description'  => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'    => 'Le nom du modèle est obligatoire.',
            'ota_capable.boolean' => 'Le champ OTA doit être vrai ou faux.',
        ];
    }
}
